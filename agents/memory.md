# Agent Service - Memory Document

This file preserves key context, tech stack choices, architectural patterns, and decisions for
the `agents/` Python service across workspace interactions. It covers only the agent service;
the Next.js frontend has its own `memory.md` at the repository root.

Design spec: `docs/superpowers/specs/2026-07-15-agentic-layer-design.md`

## Project Core Metadata
- **Name**: Agent Service (chat copilot for the Cost Management App)
- **Directory**: `/home/sourov/Desktop/practice_supa/agents`
- **Tech Stack**:
  - Language: Python >= 3.13, managed with `uv`
  - Web: FastAPI, SSE streaming
  - LLM: Groq (`openai/gpt-oss-120b`), via `AsyncOpenAI(base_url="https://api.groq.com/openai/v1")`
  - Orchestration: **OpenAI Agents SDK** (`openai-agents` 0.18). No LangGraph, not a raw loop —
    see Decisions below.
  - Tracing: the SDK's own tracing is **disabled** (`set_tracing_disabled(True)`); it requires an
    OpenAI key this service does not have. Tracing is handled by other tooling.
  - Database: `supabase-py` 2.31, RLS-scoped by the user's forwarded JWT
  - Validation: the SDK generates tool schemas from type hints + docstrings

## Architecture & Conventions

### 1. Four layers, one direction of dependency
```
Next.js /api/chat  ->  api/  ->  agent/  ->  tools/  ->  db/
```
Nothing skips a layer. The boundary rules are what keep files small:
- `db/` knows nothing about LLMs. Plain **sync** functions: arguments in, rows out.
- `tools/` knows nothing about HTTP. Unwraps the run context and calls `db/`.
- `agent/` knows nothing about FastAPI. Yields events.
- `api/` knows nothing about Groq. Wires request -> run -> SSE.

Target: each file under ~100 lines. Anti-monolith, mirroring the frontend convention.

### 1b. Async, with one rule
`Runner.run_streamed()` is an async iterator, so `api/`, `agent/`, and the tool functions are
`async def`. But **supabase-py is synchronous** — every db call from a tool goes through
`asyncio.to_thread`, or it blocks the event loop. The `db/` layer itself stays plain sync
functions, which keeps it trivial to read and test.

### 2. Security model — the database is the enforcement point
- Next.js reads the session server-side and forwards `session.access_token` as
  `Authorization: Bearer <jwt>`. The token never reaches browser JavaScript.
- `api/deps.py` builds a `supabase-py` client carrying that JWT. Every query runs as that user.
- **If the agent hallucinates a `user_id`, Postgres rejects the query.** RLS is the backstop
  against both LLM error and prompt injection.
- **No service-role key exists in this service.** It would bypass RLS entirely. Background
  workers will need one later; that is a separate code path and must never be reachable from
  the chat path.

### 3. Write policy
- Reads and writes (`add_transaction`, `update_transaction`, `set_budget`) auto-execute.
- **Deletes require confirmation, and the Python service never deletes anything.**
  `propose_delete_transaction` only reads the row and returns it as a proposal. The loop emits
  `confirm_required`; the frontend renders a card; Next.js performs the actual delete via
  `lib/supabase/server.ts`. The destructive capability does not exist in the agent's process.

### 4. Statelessness
No server-side conversation state. The frontend holds the message array and sends it each turn.
No chat table yet.

### 5. Error handling
A failed tool call is **data for the LLM, not a crash**. `db/` raises typed exceptions
(`NotFound`, `PermissionDenied`); handlers catch them and return `{"error": "..."}` as a tool
result so the model can explain or retry. Only Groq-unreachable and invalid-JWT reach the HTTP
layer as real errors.

## Decisions & Rationale

- **OpenAI Agents SDK, over both LangGraph and a raw loop.** LangGraph was rejected outright: its
  draws (`interrupt()`, checkpointer/store) are routed around here, since Next.js owns the delete
  and memory is deferred. The Agents SDK won over a raw loop because `@function_tool` generates
  schemas from type hints + docstrings (deleting a hand-written schema/registry module and its
  drift risk), `failure_error_function` is exactly our error policy, `RunContextWrapper` threads
  the per-request Supabase client cleanly, and `Sessions` maps onto the memory phase. The cost
  paid knowingly: the loop is now a black box rather than ~40 readable lines.
- **Fixed typed tools over raw SQL**: three small tables. Predictable, testable, and the LLM
  cannot invent an expensive or malformed query.
- **Aggregation in Python, not Postgres**: one user's transactions is a trivial volume. An RPC
  would be faster but adds a migration and hides logic. Revisit only if measurably slow.

## Gotchas

All of these were verified against the live Groq and Supabase, not recalled from memory.

- **`@function_tool(strict_mode=False)` is MANDATORY on every tool.** The SDK defaults to
  `strict_mode=True`, which breaks this design two ways:
  1. It forces every optional argument into the schema's `required` list, so optional filters
     stop being optional and the model invents values. An observed run passed `category='food'`
     on a question that named no category.
  2. With `Optional[SomeEnum]`, pydantic emits `anyOf: [Enum, null]` and Groq hard-rejects it:
     `400 ... anyOf branches must be disambiguated via a required discriminator`.

  With `strict_mode=False`, `required` correctly omits optional args and the model supplies
  correctly-capitalized enum values. A test asserts no tool marks an optional arg required.

- **The Groq model ID is `openai/gpt-oss-120b`, WITH the `openai/` prefix.** The bare
  `gpt-oss-120b` does not exist and 404s. Groq's catalog churns — never hardcode from memory:
  ```
  curl -s https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"
  ```

- **The Supabase client needs BOTH `apiKey` and `Authorization` headers.** `Authorization` alone
  returns 401 from the gateway. And `Client.create()` only injects `apiKey` when the caller has
  *not* supplied their own `Authorization` (supabase/_sync/client.py:108) — which we always do.
  Passing a `headers` dict also replaces the library defaults entirely. So pass both, explicitly.

- **`gpt-oss` is a reasoning model.** The stream emits `reasoning_item_created` events. Map or
  ignore them deliberately; don't let them surprise you.

- **The DB does not constrain vocabulary.** `type`, `category`, and `recurring_interval` are all
  plain `string` with no CHECK constraints. Postgres will happily store `category="Groceries"`,
  and the budgets page (which matches by string equality) will then silently never match it.
  The `models.py` enums are the ONLY guard. Values come from the frontend, the sole definition:
  `components/dashboard/transaction-modal.tsx`.
- **Next.js here has breaking changes** from common knowledge. Read the relevant guide under
  `node_modules/next/dist/docs/` before writing the route handler. See root `AGENTS.md`.
- **Root `memory.md` is aspirational about testing.** It claims Vitest with `tests/utils.test.ts`
  and `tests/proxy.test.ts`; neither the dependency, the script, nor the files exist.

## Active Database Schema Notes

Shared with the frontend. RLS-scoped by `user_id` on every table.
- **profiles**: `id`, `username`, `currency`, `monthly_budget`, `updated_at`
- **transactions**: `id`, `user_id`, `amount`, `type`, `category`, `date`, `description`,
  `recurring_interval`, `created_at`
- **budgets**: `id`, `user_id`, `category`, `month_year`, `limit_amount`, `created_at`
