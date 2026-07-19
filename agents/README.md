# Agent Service

Chat copilot for the cost-management app. A user asks a question in natural language
("how much did I spend on food last month?", "add $40 groceries yesterday") and an
LLM reads and writes their Supabase data through eight typed tools.

- Design spec: `../docs/superpowers/specs/2026-07-15-agentic-layer-design.md`
- Context and gotchas: `memory.md`
- Milestones: `progress.md`

## Run it

```bash
cd agents
uv run uvicorn agent_service.main:app --reload    # http://127.0.0.1:8000
curl localhost:8000/health                        # {"status":"ok"}
```

(`fastapi dev` would also work but needs `uv add "fastapi[standard]"` first — the
CLI is not part of the base `fastapi` package. uvicorn is already installed.)

`POST /chat` takes `{"messages": [{"role": "user", "content": "..."}]}` plus an
`Authorization: Bearer <supabase-jwt>` header, and streams SSE events:
`tool_call`, `confirm_required`, `text`, `done`, `error`.

## Layout

Four layers, one direction of dependency. Nothing skips a layer.

```
api/     FastAPI routes, auth, SSE encoding   — knows nothing about Groq
agent/   Agent definition, Groq binding, run  — knows nothing about FastAPI
tools/   the eight @function_tool functions   — knows nothing about HTTP
db/      Supabase queries (plain sync)        — knows nothing about LLMs
```

## The two rules that matter

**No service-role key lives here.** The user's JWT is forwarded from Next.js and
attached to every query, so Postgres RLS — not application code — is what stops one
user reading another's data. A service-role key would bypass RLS entirely. Background
workers will need one eventually; that is a separate service.

**This service cannot delete.** `propose_delete_transaction` only reads a row and
returns it for confirmation. The frontend performs the delete after the user agrees.
The capability does not exist in this process.

## Environment

`.env` (gitignored) needs `GROQ_API_KEY`, `GROQ_MODEL`, `SUPABASE_URL`,
`SUPABASE_ANON_KEY`. See `memory.md` for the non-obvious parts — especially why every
tool must set `strict_mode=False`, and why the Supabase client passes two headers.
