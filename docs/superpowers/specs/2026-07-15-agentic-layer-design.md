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
| Orchestration | Raw OpenAI SDK tool loop. No LangGraph. | See "Orchestration" below. |
| Database auth | Forward the user's Supabase JWT | RLS enforces user isolation in Postgres, so an LLM mistake cannot cross users. |
| Write policy | Reads and writes auto-execute; deletes require user confirmation | Inserts/updates are cheap to undo. Deletes are not. |
| Tool surface | Eight fixed typed tools. No raw SQL. | Schema is three small tables. Predictable and testable. |
| Conversation state | None server-side. Frontend sends the message array each turn. | No chat table needed yet. YAGNI. |

### Orchestration: why raw SDK, not LangGraph

The tool loop is roughly 40 lines: call the model, check `tool_calls`, run handlers, append
`role: "tool"` messages, repeat. A framework would hide the one part of this project most worth
understanding. This is a single agent with eight tools, stateless and non-branching — a
`StateGraph` earns nothing over the loop it wraps.

The honest case for LangGraph is real but deferred: `interrupt()` targets human-in-the-loop
flows, and its checkpointer/store map onto short-term and long-term memory — the next phase.
Both draws are routed around here. Delete-confirm needs no `interrupt()` because Next.js owns
the delete (see Tools), and memory is explicitly out of scope.

The layered design contains the blast radius: `llm/loop.py` is the only file that knows how the
loop works. `tools/`, `db/`, and `api/` do not. Migrating to LangGraph later means rewriting one
file. **Reevaluate at the memory phase**, when durable checkpointing and semantic recall are
actually on the table and the loop it would replace is well understood.

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
  llm/      Groq client + tool-calling loop
        ▼
  tools/    JSON schemas + handlers (the LLM-facing contract)
        ▼
  db/       Supabase queries, RLS-scoped by the user's JWT
```

Boundary rules, which are what keep each file small and readable:

- `db/` knows nothing about LLMs. Plain functions: arguments in, rows out.
- `tools/` knows nothing about HTTP. Turns LLM JSON arguments into `db/` calls.
- `llm/` knows nothing about FastAPI. Yields events.
- `api/` knows nothing about Groq. Wires request → loop → SSE.

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
      deps.py                 # Bearer JWT -> UserContext dependency
      chat.py                 # POST /chat -> SSE stream
    llm/
      client.py               # OpenAI SDK pointed at Groq
      prompts.py              # system prompt
      loop.py                 # the tool-calling loop
    tools/
      schemas.py              # JSON schemas the LLM sees (generated from models.py)
      handlers.py             # arg dict -> db call -> result dict
      registry.py             # name -> (schema, handler)
    db/
      client.py               # supabase-py client built from the user's JWT
      transactions.py
      budgets.py
      profiles.py
    models.py                 # pydantic types shared across layers
  tests/
```

Target: roughly twelve files, each under ~100 lines, rather than one large `main.py`.

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

Each tool's argument schema is generated from a pydantic model in `models.py`. The JSON schema
the LLM sees and the validation that runs are produced from the same source, so they cannot
drift apart.

## Data flow

1. User types in the dashboard chat panel. The frontend POSTs `{ messages: [...] }` to `/api/chat`.
2. The Next.js route attaches the JWT and proxies to FastAPI.
3. `deps.py` builds the RLS-scoped Supabase client.
4. `loop.py` runs: call Groq with the messages and tool schemas. If the response contains
   `tool_calls`, execute each handler, append the results as `role: "tool"` messages, and call
   again. Repeat until the model returns plain text. Hard cap of **8 iterations**, then bail
   with an explanatory message.
5. Events stream back as SSE: `text` deltas, `tool_call` (so the UI can show "checking your
   transactions…"), `confirm_required`, `done`, `error`.

## Error handling

Each layer handles its own class of failure.

- `db/` raises typed exceptions (`NotFound`, `PermissionDenied`). An RLS rejection surfaces as
  `PermissionDenied` — a real signal that something is wrong, not a routine outcome.
- `tools/handlers.py` catches those and returns `{"error": "..."}` **to the model as a tool
  result**, not as an HTTP 500. A failed tool call is data for the LLM, not a crash. The model
  explains it to the user or tries a different approach.
- Pydantic rejects malformed LLM arguments before they reach `db/`. That validation error also
  returns to the model as a tool result so it can correct itself.
- `api/chat.py` catches only the genuinely fatal: Groq unreachable, JWT invalid or expired.

## Testing

- `db/` — integration tests against a real Supabase test user. **Includes a test proving user A
  cannot read user B's rows.** That test is the entire security model; write it first.
- `tools/` — unit tests with a faked db layer. Assert that schemas and handlers agree.
- `llm/loop.py` — unit tests with a scripted fake Groq client returning canned `tool_calls`.
  No network, no flake. Covers: single tool call, multi-round, iteration cap, tool raising.
- `api/` — FastAPI `TestClient` with a faked loop. Covers auth rejection and SSE framing.

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
   Explicitly planned as the next phase after the copilot works. Reevaluate LangGraph here.
2. **Background workers** — cron-driven auto-categorization, budget-overrun alerts, recurring
   transaction materialization, weekly summaries. Requires the service-role key and a separate
   auth path.
3. **Persistent chat history** — a `messages` table. Requires a schema migration.
4. **Raw SQL escape hatch** — a guarded read-only `run_analytics_sql` tool. Add only if the
   fixed tools prove insufficient.

## Open items for implementation

- Confirm the Groq model ID from the live models endpoint; verify tool-calling support.
- Confirm `transactions.type` allowed values (`income` / `expense`) and
  `recurring_interval` allowed values against the live database before writing the enums
  in `models.py`. The generated TypeScript types say `string`, which is not specific enough.
- Read the relevant guide under `node_modules/next/dist/docs/` before writing the Next.js
  route handler. This Next.js version has breaking changes from common knowledge (see AGENTS.md).
- Root `memory.md` claims Vitest is configured with `tests/utils.test.ts` and `tests/proxy.test.ts`.
  Neither the dependency, the test script, nor the files exist. Treat that file as aspirational.
