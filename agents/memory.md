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
  - LLM: Groq, accessed through the OpenAI SDK (`base_url="https://api.groq.com/openai/v1"`)
  - Orchestration: raw OpenAI SDK tool loop. **No LangGraph** — see Decisions below.
  - Database: `supabase-py`, RLS-scoped by the user's forwarded JWT
  - Validation: pydantic (single source for both tool JSON schemas and runtime validation)

## Architecture & Conventions

### 1. Four layers, one direction of dependency
```
Next.js /api/chat  ->  api/  ->  llm/  ->  tools/  ->  db/
```
Nothing skips a layer. The boundary rules are what keep files small:
- `db/` knows nothing about LLMs. Arguments in, rows out.
- `tools/` knows nothing about HTTP. LLM JSON args -> `db/` calls.
- `llm/` knows nothing about FastAPI. Yields events.
- `api/` knows nothing about Groq. Wires request -> loop -> SSE.

Target: ~12 files, each under ~100 lines. Anti-monolith, mirroring the frontend convention.

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

- **Raw SDK over LangGraph**: the loop is ~40 lines; a framework would hide the part most worth
  understanding. Single agent, 8 tools, stateless, non-branching — `StateGraph` earns nothing.
  LangGraph's real draws (`interrupt()` for human-in-the-loop, checkpointer/store for memory)
  are routed around: Next.js owns the delete, and memory is deferred. `llm/loop.py` is the only
  file that knows the loop, so migrating later means rewriting one file.
  **Reevaluate at the memory phase.**
- **Fixed typed tools over raw SQL**: three small tables. Predictable, testable, and the LLM
  cannot invent an expensive or malformed query.
- **Aggregation in Python, not Postgres**: one user's transactions is a trivial volume. An RPC
  would be faster but adds a migration and hides logic. Revisit only if measurably slow.

## Gotchas

- **Groq model IDs churn.** Never hardcode one from memory. Query
  `GET https://api.groq.com/openai/v1/models`, pick from the live list, and confirm tool-calling
  support. The ID lives in `config.py` as an env var.
- **`transactions.type` and `recurring_interval` are typed `string`** in the generated
  `types/supabase.ts`. Confirm the real allowed values against the live database before writing
  enums in `models.py`.
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
