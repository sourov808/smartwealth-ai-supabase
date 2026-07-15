# Agent Service - Progress Log

Tracks implementation milestones for the `agents/` Python service.
Design spec: `docs/superpowers/specs/2026-07-15-agentic-layer-design.md`

## Journey Milestones

### Phase 0: Design
- [x] Choose agent surface (chat copilot now, background workers later)
- [x] Choose transport (FastAPI HTTP service proxied by a Next.js route)
- [x] Choose LLM provider (Groq via the OpenAI SDK)
- [x] Choose orchestration (raw SDK tool loop; no LangGraph — reevaluate at memory phase)
- [x] Choose database auth (forward the user's JWT; RLS enforces isolation)
- [x] Choose write policy (reads/writes auto; deletes confirmed via the frontend)
- [x] Choose tool surface (eight fixed typed tools; no raw SQL)
- [x] Write design spec
- [x] Create agent service memory tracker (`agents/memory.md`)
- [x] Create agent service progress tracker (`agents/progress.md`)
- [ ] Write implementation plan

### Phase 1: Scaffold & Config
- [ ] Add dependencies to `pyproject.toml` (fastapi, openai, supabase, pydantic, pytest)
- [ ] Restructure to `src/agent_service/` layout
- [ ] Write `config.py` (env -> Settings, fails loudly on missing vars)
- [ ] Create `.env` and confirm it is gitignored
- [ ] Confirm the Groq model ID from the live models endpoint; verify tool-calling support

### Phase 2: Database Layer
- [ ] Confirm `transactions.type` and `recurring_interval` allowed values against the live DB
- [ ] Write `models.py` pydantic types
- [ ] Write `db/client.py` (build a supabase client from a user JWT)
- [ ] **Write the cross-user isolation test first** (user A cannot read user B's rows)
- [ ] Write `db/transactions.py`, `db/budgets.py`, `db/profiles.py` with typed exceptions
- [ ] Integration tests against a real Supabase test user

### Phase 3: Tool Layer
- [ ] Write `tools/schemas.py` (generated from `models.py`)
- [ ] Write `tools/handlers.py` (errors return to the model as tool results, never as 500s)
- [ ] Write `tools/registry.py`
- [ ] Unit tests with a faked db layer; assert schema/handler agreement

### Phase 4: LLM Layer
- [ ] Write `llm/client.py` (OpenAI SDK pointed at Groq)
- [ ] Write `llm/prompts.py` (system prompt)
- [ ] Write `llm/loop.py` (tool loop, 8-iteration hard cap)
- [ ] Unit tests with a scripted fake Groq client (single call, multi-round, cap, tool raises)

### Phase 5: API Layer
- [ ] Write `api/deps.py` (Bearer JWT -> UserContext)
- [ ] Write `api/chat.py` (POST /chat -> SSE: text, tool_call, confirm_required, done, error)
- [ ] Write `main.py` (app assembly only)
- [ ] TestClient tests for auth rejection and SSE framing

### Phase 6: Frontend Integration
- [ ] Read the relevant guide under `node_modules/next/dist/docs/` before writing the route
- [ ] Write Next.js `/api/chat` route (attach JWT server-side, proxy, stream)
- [ ] Build the dashboard chat panel component
- [ ] Build the delete confirmation card + Next.js server action that performs the delete
- [ ] End-to-end verification against the real app

### Phase 7: Deploy
- [ ] Deploy FastAPI (Railway or Fly)
- [ ] Set `AGENT_SERVICE_URL` in the Next.js environment

## Deferred (each needs its own design cycle)
- [ ] Agent memory: short-term, long-term, semantic — **next phase after the copilot works**
- [ ] Background workers (needs the service-role key and a separate auth path)
- [ ] Persistent chat history (`messages` table, requires a migration)
- [ ] Raw SQL escape hatch (`run_analytics_sql`) — only if the fixed tools prove insufficient

---

## Log of Completed Steps
- **2026-07-15**: Design phase complete. Settled the agentic layer as a chat copilot backed by a
  Python FastAPI service in `agents/`, using Groq through the OpenAI SDK with a raw tool loop
  rather than LangGraph. Established the four-layer architecture (api -> llm -> tools -> db) with
  one-directional dependencies and a ~100-line-per-file target. Settled the security model on
  forwarding the user's Supabase JWT so RLS enforces user isolation in Postgres, with no
  service-role key anywhere in the service. Settled the delete flow so the Python service holds
  no destructive capability at all — it proposes, and Next.js executes after user confirmation.
  Wrote the design spec and created the service's memory and progress trackers. Next: the
  implementation plan.
