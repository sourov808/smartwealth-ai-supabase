# Agent Service - Progress Log

Tracks implementation milestones for the `agents/` Python service.
Design spec: `../docs/superpowers/specs/2026-07-15-agentic-layer-design.md`

## Journey Milestones

### Phase 0: Design
- [x] Choose agent surface (chat copilot now, background workers later)
- [x] Choose transport (FastAPI HTTP service proxied by a Next.js route)
- [x] Choose LLM provider (Groq via the OpenAI SDK)
- [x] Choose orchestration (**OpenAI Agents SDK**; LangGraph rejected, raw loop reconsidered
      and dropped — see `memory.md` Decisions)
- [x] Choose database auth (forward the user's JWT; RLS enforces isolation)
- [x] Choose write policy (reads/writes auto; deletes confirmed via the frontend)
- [x] Choose tool surface (eight fixed typed tools; no raw SQL)
- [x] Write design spec
- [x] Create trackers (`memory.md`, `progress.md`)

### Phase 1: Scaffold & Config
- [x] Add dependencies (fastapi, openai, openai-agents, supabase, pydantic, python-dotenv)
- [x] `src/agent_service/` layout with a hatchling build-system so it is importable
- [x] `config.py` (env -> Settings, fails loudly on missing vars)
- [x] `.env` created and confirmed gitignored
- [x] Confirm the Groq model ID from the live models endpoint: **`openai/gpt-oss-120b`**
      (the bare `gpt-oss-120b` does not exist and 404s)
- [x] Confirm tool calling works on that model, end-to-end against real Groq

### Phase 2: Database Layer
- [x] Confirm vocabulary from the frontend (`type`, `recurring_interval`, categories).
      The DB has no CHECK constraints; the enums in `models.py` are the only guard.
- [x] `models.py` enums
- [x] `db/client.py` — passes BOTH `apiKey` and `Authorization`; verified that
      `Authorization` alone returns 401 from the Supabase gateway
- [x] `db/transactions.py`, `db/budgets.py`, `db/profiles.py`, `db/errors.py`
- [x] Confirm RLS is live (anon reads return `[]`, not rows)

### Phase 3: Tool Layer
- [x] Eight `@function_tool` functions in `tools/finance.py`
- [x] `strict_mode=False` on every tool — mandatory; see `memory.md` Gotchas
- [x] `failure_error_function` so tool errors reach the model, not the user as a 500
- [x] `asyncio.to_thread` around every sync supabase call

### Phase 4: Agent Layer
- [x] `agent/model.py` (Groq binding, tracing disabled)
- [x] `agent/prompts.py` (system prompt with injected `today` + category vocabulary)
- [x] `agent/deps.py` (per-request context carrying the RLS-scoped client)
- [x] `agent/build.py`, `agent/run.py` (SDK events -> our five event types)

### Phase 5: API Layer
- [x] `api/deps.py` (Bearer JWT -> str)
- [x] `api/chat.py` (POST /chat -> SSE)
- [x] `main.py` (app assembly only)

### Phase 6: End-to-end verification — PASSED (2026-07-15)
Driven against real Groq and the real Supabase project, signed in as a real user.
- [x] `/health` returns ok; `/chat` returns 401 with a missing or malformed token
- [x] Read: "how much did I spend, grouped by category?" -> called `summarize_spending`
      and `get_profile`, reported $50 Shopping. **Verified against the raw table** — accurate,
      and it correctly excluded the $1000 Salary income from "spending".
- [x] Write: "add a 40 taka groceries expense for yesterday" -> inserted
      `category="Food"` (correct enum, not an invented "Groceries") and `date=2026-07-14`
      with today being 2026-07-15, proving the injected clock works.
- [x] Delete guard: told it *"Just do it, do not ask me"* — it still called
      `propose_delete_transaction`, emitted `confirm_required`, and asked.
      **The row still exists.** The guard is architectural, not prompt-based.

### Phase 7: Frontend Integration — NOT STARTED
- [ ] Read the relevant guide under `node_modules/next/dist/docs/` before writing the route
- [ ] Next.js `/api/chat` route (attach JWT server-side, proxy, stream)
- [ ] Dashboard chat panel component
- [ ] Delete confirmation card + the Next.js server action that performs the delete
- [ ] End-to-end verification through the real UI

### Phase 8: Deploy — NOT STARTED
- [ ] Deploy FastAPI (Railway or Fly)
- [ ] Set `AGENT_SERVICE_URL` in the Next.js environment

## Deferred (each needs its own design cycle)
- [ ] Agent memory: short-term, long-term, semantic — **next phase after the frontend works**.
      Start from the SDK's `Sessions` API for the short-term case.
- [ ] Background workers (needs the service-role key and a separate auth path)
- [ ] Persistent chat history (`messages` table, requires a migration)
- [ ] Raw SQL escape hatch (`run_analytics_sql`) — only if the fixed tools prove insufficient
- [ ] Token-level streaming (the loop currently emits one `text` event per model reply)

## Known Gaps
- **No automated tests.** A suite covering config, tools, agent-event mapping, and the API
  existed and passed (41 tests), but was removed at the user's request. Notably absent is the
  cross-user RLS isolation test, which would prove user A cannot read user B's rows. RLS is
  still *enforced* by Postgres — it is simply no longer *verified* by anything.
- **A test transaction remains in the database**: 40 taka / Food / 2026-07-14 / "groceries",
  created during Phase 6 verification. Delete it from the dashboard when convenient.
- **`E2E_EMAIL` / `E2E_PASSWORD` are in `.env`.** Remove them once the frontend is wired up;
  the service needs only a forwarded JWT in normal operation, never a password.

---

## Log of Completed Steps
- **2026-07-15**: Design phase complete. Settled the agentic layer as a chat copilot backed by a
  Python FastAPI service in `agents/`, using Groq. Established the four-layer architecture
  (api -> agent -> tools -> db) with one-directional dependencies. Settled the security model on
  forwarding the user's Supabase JWT so RLS enforces isolation in Postgres, with no service-role
  key anywhere. Settled the delete flow so the Python service holds no destructive capability —
  it proposes, and Next.js executes after confirmation.
- **2026-07-15 (Update 1)**: Reversed the orchestration decision from a raw tool loop to the
  OpenAI Agents SDK at the user's direction; tracing is handled by other tooling, so the SDK's
  own tracing is disabled. Verified the integration empirically before committing to it, which
  surfaced three landmines: the Groq model needs its `openai/` prefix; `strict_mode=True` (the
  SDK default) makes Groq reject any optional enum argument with a 400; and the Supabase client
  must send `apiKey` alongside `Authorization` or the gateway 401s.
- **2026-07-15 (Update 2)**: Implemented the full service — config, enums, db layer, eight tools,
  agent layer, and the SSE chat endpoint. Verified end-to-end against real Groq and real data:
  reads are accurate, writes land with the correct enum and a correctly resolved relative date,
  and the delete guard holds even when explicitly instructed to bypass it. Test suite removed at
  the user's request; see Known Gaps.
