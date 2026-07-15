# Agentic Layer — Design

**Date**: 2026-07-15
**Status**: Approved
**Scope**: Chat copilot backed by a Python agent service with scoped access to the existing Supabase database.

## Goal

Give the cost-management app agentic power. A user types natural language in the dashboard
("how much did I spend on food last month?", "add $40 groceries yesterday") and an LLM-driven
agent reads and writes their financial data through a fixed set of typed tools.

Background workers (auto-categorization, budget-overrun alerts, recurring transactions,
weekly summaries) are a later phase and out of scope for this spec.

## Decisions

| Decision | Choice | Reasoning |
|---|---|---|
| Agent surface | Chat copilot first, background workers later | User-triggered flow is the smaller, testable slice. Workers need a different auth model. |
| Transport | Python FastAPI HTTP service, proxied by a Next.js route | Clean process boundary. Streaming via SSE. `agents/` stays its own deployable. |
| LLM provider | Groq, via the OpenAI SDK (`base_url="https://api.groq.com/openai/v1"`) | OpenAI-compatible tool calling. Fast inference. |
| Orchestration | OpenAI Agents SDK 0.18 (`openai-agents`), pointed at Groq. No LangGraph. | See "Orchestration" below. |
| Tracing | The SDK's built-in tracing is disabled (`set_tracing_disabled(True)`). Handled externally. | It requires an OpenAI API key, which this service does not have. |
| Database auth | Forward the user's Supabase JWT | RLS enforces user isolation in Postgres, so an LLM mistake cannot cross users. |
| Write policy | Reads and writes auto-execute; deletes require user confirmation | Inserts/updates are cheap to undo. Deletes are not. |
| Tool surface | Eight fixed typed tools. No raw SQL. | Schema is three small tables. Predictable and testable. |
| Conversation state | None server-side. Frontend sends the message array each turn. | No chat table needed yet. YAGNI. |

### Orchestration: OpenAI Agents SDK

Three options were weighed: a raw OpenAI SDK tool loop, LangGraph, and the OpenAI Agents SDK.

**LangGraph was rejected.** Its real draws — `interrupt()` for human-in-the-loop, and its
checkpointer/store for memory — are both routed around by this design. Next.js owns the delete,
so no `interrupt()` is needed, and memory is out of scope. A `StateGraph` earns nothing over a
single non-branching agent.

**The Agents SDK was chosen over a raw loop.** The tradeoff is honest and was made with eyes
open: a raw loop is ~40 lines and teaches how tool calling actually works, which has real value.
Against that, the SDK provides:

- `@function_tool` generates the JSON schema from type hints and the docstring, which removes a
  hand-written schema/registry module and the drift risk that comes with it.
- `failure_error_function` returns tool errors to the model rather than raising — exactly the
  error policy this design already specified.
- `RunContextWrapper` threads the per-request Supabase client into tools cleanly.
- `Sessions` map onto the deferred memory phase.

Its built-in tracing wants an OpenAI API key and is disabled via `set_tracing_disabled(True)`;
tracing is handled by other tooling.

Groq is not the SDK's primary path, so the integration is pinned explicitly:
`OpenAIChatCompletionsModel(model=<GROQ_MODEL>, openai_client=AsyncOpenAI(base_url=<groq>))`.
This was verified end-to-end against live Groq before being written down here — see Gotchas.

### Gotcha: `strict_mode=False` is mandatory

`@function_tool` defaults to `strict_mode=True`, which is **incompatible with this design**.
Both failures were reproduced against live Groq:

1. Strict mode forces every optional argument into the schema's `required` list. Optional
   filters stop being optional, and the model invents values for them — an observed run passed
   `category='food'` on a question that named no category.
2. With a genuinely optional enum (`Optional[Category]`), pydantic emits
   `anyOf: [Category, null]`, and Groq rejects the request outright:
   `400 ... anyOf branches must be disambiguated via a required discriminator`.

With `strict_mode=False`, `required` correctly omits optional arguments and the model supplies
correctly-capitalized enum values. **Every tool must pass `strict_mode=False`.**

### Consequence: the service is async

`Runner.run_streamed()` returns an async iterator, so the API layer and the tool functions are
`async def`. The supabase-py client is synchronous, so tool functions must not call it directly
on the event loop — every db call goes through `asyncio.to_thread`. The `db/` layer itself stays
plain synchronous functions, which keeps it trivial to read and test.

### Model selection

Groq model IDs change frequently. Do **not** hardcode a model ID from memory during
implementation. Query `GET https://api.groq.com/openai/v1/models` and select from the live
list, confirming the chosen model supports tool calling. The model ID lives in `config.py`
as an env var so it can be swapped without a code change.

## Architecture

Four layers with a single direction of dependency. Nothing skips a layer.

```
Next.js /api/chat  (server route: reads session, attaches JWT, proxies)
        │  HTTP + SSE
        ▼
  api/      FastAPI routes, auth dependency, SSE encoding
        ▼
  agent/    Agent definition, Groq model binding, run + event mapping
        ▼
  tools/    @function_tool definitions (the LLM-facing contract)
        ▼
  db/       Supabase queries, RLS-scoped by the user's JWT
```

Boundary rules, which are what keep each file small and readable:

- `db/` knows nothing about LLMs. Plain synchronous functions: arguments in, rows out.
- `tools/` knows nothing about HTTP. Unwraps the run context and calls `db/`.
- `agent/` knows nothing about FastAPI. Yields events.
- `api/` knows nothing about Groq. Wires request → run → SSE.

### Folder layout

```
agents/
  .env                        # GROQ_API_KEY, GROQ_MODEL, SUPABASE_URL, SUPABASE_ANON_KEY
  pyproject.toml
  memory.md                   # durable context for the agent service
  progress.md                 # milestone tracker
  src/agent_service/
    config.py                 # env -> Settings; fails loudly if a var is missing
    main.py                   # FastAPI app assembly only
    api/
      deps.py                 # Bearer JWT -> str dependency
      chat.py                 # POST /chat -> SSE stream
    agent/
      deps.py                 # AgentDeps: the per-request context object
      model.py                # OpenAIChatCompletionsModel bound to Groq
      prompts.py              # system prompt (instructions)
      build.py                # assembles the Agent
      run.py                  # Runner.run_streamed -> our event dicts
    tools/
      finance.py              # the eight @function_tool functions
    db/
      client.py               # supabase-py client built from the user's JWT
      errors.py               # NotFound, PermissionDenied
      transactions.py
      budgets.py
      profiles.py
    models.py                 # enums shared by tools/ and the frontend contract
  tests/
```

Target: each file under ~100 lines, rather than one large `main.py`.

Note: the SDK generates tool schemas from type hints and docstrings, so the previously planned
`tools/schemas.py` and `tools/registry.py` no longer exist. That is the main structural saving
from adopting the SDK.

## Security model

The database is the enforcement point, not the application.

1. The Next.js route handler calls `supabase.auth.getSession()` server-side and forwards
   `session.access_token` to FastAPI as `Authorization: Bearer <jwt>`. The token is never
   exposed to browser JavaScript.
2. `api/deps.py` decodes the JWT for `sub` (the user id) and constructs a `supabase-py`
   client carrying that token.
3. Every query from `db/` therefore runs as that user. **If the agent hallucinates a
   `user_id`, Postgres rejects the query.** RLS is the backstop against LLM error and
   prompt injection alike.

No service-role key exists in this service. When background workers arrive later, they will
need one (no user session exists for a cron job), and that will be a separate code path with
its own review — a service-role key bypasses RLS entirely and must never be reachable from
the chat path.

An expired JWT surfaces as a 401. The frontend refreshes the session and retries.

## Tools

Derived from the live schema in `types/supabase.ts`.

### Reads

| Tool | Arguments | Returns |
|---|---|---|
| `list_transactions` | `start_date?`, `end_date?`, `category?`, `type?`, `limit` (default 50, max 200) | matching rows |
| `summarize_spending` | `start_date`, `end_date`, `group_by` (`category`\|`type`\|`month`) | aggregated totals |
| `list_budgets` | `month_year?` | matching rows |
| `get_profile` | — | currency, monthly_budget, username |

### Writes (auto-execute)

| Tool | Arguments |
|---|---|
| `add_transaction` | `amount`, `type`, `category`, `date?`, `description?`, `recurring_interval?` |
| `update_transaction` | `id`, plus any mutable field |
| `set_budget` | `category`, `month_year`, `limit_amount` (upsert) |

### Delete (confirmation required)

| Tool | Behavior |
|---|---|
| `propose_delete_transaction` | Takes `id`. **Does not delete.** Fetches the row and returns it as a proposal. |

**The Python service never deletes anything.** `propose_delete_transaction` reads the row and
returns it. The loop emits a `confirm_required` SSE event carrying the row. The frontend
renders a confirmation card. When the user clicks Confirm, **Next.js** performs the delete via
the existing `lib/supabase/server.ts` client as a normal server action.

The rationale: the agent service stays stateless. No pending-action table, no in-memory dict
that dies on restart, no second auth path. The destructive capability never exists in the
agent's process at all — a stronger guarantee than a confirmation flag, and less code.

### Aggregation

`summarize_spending` groups rows in Python (fetch, then group with a dict) rather than in
Postgres. The data volume is a single user's transactions — trivially small. A Postgres RPC
would be faster but adds a migration and hides the logic. Revisit only if it measurably slows.

### Schema generation

Schemas are generated by `@function_tool` from each function's type hints and its Google-style
docstring. The signature the code enforces and the schema the model sees are therefore the same
artifact and cannot drift. Enum arguments use `StrEnum` types from `models.py`, which is what
puts the exact category vocabulary in front of the model.

## Data flow

1. User types in the dashboard chat panel. The frontend POSTs `{ messages: [...] }` to `/api/chat`.
2. The Next.js route attaches the JWT and proxies to FastAPI.
3. `api/deps.py` extracts the JWT; `agent/deps.py` wraps an RLS-scoped Supabase client in an
   `AgentDeps` context object.
4. `Runner.run_streamed(agent, input=..., context=AgentDeps(...), max_turns=8)` runs the loop.
   Tools receive the client via `RunContextWrapper`.
5. `agent/run.py` maps the SDK's stream events onto our own vocabulary and yields them.
6. Events stream back as SSE: `text`, `tool_call` (so the UI can show "checking your
   transactions…"), `confirm_required`, `done`, `error`.

The SDK's `max_turns=8` replaces the hand-rolled iteration cap. Exceeding it raises
`MaxTurnsExceeded`, which `agent/run.py` converts into an `error` event.

## Error handling

Each layer handles its own class of failure.

- `db/` raises typed exceptions (`NotFound`, `PermissionDenied`). An RLS rejection surfaces as
  `PermissionDenied` — a real signal that something is wrong, not a routine outcome.
- Each `@function_tool` passes a `failure_error_function` that turns any exception into a string
  **returned to the model as the tool result**, not an HTTP 500. A failed tool call is data for
  the LLM, not a crash. The model explains it to the user or tries a different approach.
- The SDK validates arguments against the generated schema before the function is entered, and
  returns schema violations to the model the same way.
- `api/chat.py` catches only the genuinely fatal: Groq unreachable, JWT invalid or expired.
  Because SSE headers are sent before the run starts, mid-stream failures are delivered as an
  `error` event rather than an HTTP status.

## Testing

- `db/` — integration tests against a real Supabase test user. **Includes a test proving user A
  cannot read user B's rows.** That test is the entire security model; write it first.
- `tools/` — unit tests calling the tool functions directly with a faked db layer, plus schema
  assertions. **One test must assert that no tool's schema puts an optional argument in
  `required`** — that is the `strict_mode` regression, and it fails as a Groq 400 at runtime.
- `agent/run.py` — unit tests with a fake model, using the SDK's own test doubles rather than a
  network call. Covers: single tool call, event mapping, `confirm_required` detection, and
  `MaxTurnsExceeded`.
- `api/` — FastAPI `TestClient` with a faked run. Covers auth rejection and SSE framing.

Only `db/` requires a network. Everything else runs offline in milliseconds.

## Deployment

- Local: `uv run fastapi dev` on port 8000, alongside `next dev` on port 3000.
- Production: FastAPI to Railway or Fly. Next.js gets `AGENT_SERVICE_URL` in its env.
- `agents/.env` holds `GROQ_API_KEY`, `GROQ_MODEL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
  It must be gitignored. No service-role key belongs in this service.

## Out of scope (future work)

Deliberately excluded from this spec. Each needs its own design cycle.

1. **Agent memory** — short-term (conversation window management), long-term (durable user
   facts and preferences), and semantic (embedding-based retrieval over transaction history).
   Explicitly planned as the next phase after the copilot works. Start from the SDK's
   `Sessions` API, which already covers the short-term case.
2. **Background workers** — cron-driven auto-categorization, budget-overrun alerts, recurring
   transaction materialization, weekly summaries. Requires the service-role key and a separate
   auth path.
3. **Persistent chat history** — a `messages` table. Requires a schema migration.
4. **Raw SQL escape hatch** — a guarded read-only `run_analytics_sql` tool. Add only if the
   fixed tools prove insufficient.

## Resolved during design

- **Groq model**: `openai/gpt-oss-120b`, confirmed present on the live models endpoint and
  confirmed to perform tool calling end-to-end. Note the `openai/` prefix — the bare
  `gpt-oss-120b` does not exist and 404s. Stored in `GROQ_MODEL`, never hardcoded.
- **Vocabulary**: `type` is `expense`/`income`; `recurring_interval` is
  `none`/`daily`/`weekly`/`monthly`/`yearly`; categories are as listed in the frontend. All read
  from the frontend source, which is the only place these are defined — **the database columns
  are plain `string` with no CHECK constraints**, so nothing in Postgres rejects an invented
  category. The enums in `models.py` are the only guard.
- **supabase-py client construction**: both `apiKey` and `Authorization` headers must be passed
  explicitly. Verified: `Authorization` alone returns 401 from the Supabase gateway, and
  `Client.create()` skips injecting `apiKey` whenever the caller supplies their own
  `Authorization` header.

## Open items for implementation

- Read the relevant guide under `node_modules/next/dist/docs/` before writing the Next.js
  route handler. This Next.js version has breaking changes from common knowledge (see AGENTS.md).
- Root `memory.md` claims Vitest is configured with `tests/utils.test.ts` and `tests/proxy.test.ts`.
  Neither the dependency, the test script, nor the files exist. Treat that file as aspirational.
- `EXPENSE_CATEGORIES` is already duplicated in `components/dashboard/transaction-modal.tsx` and
  `app/dashboard/budgets/page.tsx`. `models.py` becomes a third copy in a second language. Not
  addressed here, but it is a live drift risk: if the lists diverge, the agent and the budgets
  page silently disagree about what a category is.
