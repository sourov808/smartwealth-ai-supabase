# Agent Memory — Design

Status: approved, not yet implemented
Supersedes the "Agent memory" line under Deferred in `agents/progress.md`.
Builds on: `docs/superpowers/specs/2026-07-15-agentic-layer-design.md`

## Problem

The agent service is stateless. The frontend holds the message array and resends it
every turn, and nothing about a user survives the conversation. Two distinct gaps
follow from that, and they are unrelated to each other:

1. A long conversation grows without bound. Nothing trims it, so a runaway session
   eventually fails against the model's context limit with no guard.
2. The agent cannot know anything durable about the user. "I get paid on the 25th"
   is forgotten the moment the tab closes.

This design addresses both. They share a name and nothing else — separate mechanisms,
separate storage, separate failure modes.

## Scope

| | Short-term | Long-term |
|---|---|---|
| What | trim the message array | durable user facts |
| Where | `agent/` layer, pure function | new table + two tools |
| Storage | none | `agent_memories`, RLS-scoped |
| Token cost | zero | bounded at ~600/turn |
| Frontend work | none | none |

Explicitly out of scope, each needing its own design cycle:

- **Persistent chat history.** Conversations still do not survive a refresh. A
  `messages` table remains deferred.
- **Semantic retrieval.** No pgvector, no embeddings. The cap in §4 is what tells us
  when this becomes necessary.
- **Automatic fact extraction.** Facts are written only when the model calls the tool.

### The SDK `Sessions` API is not used

`agents/progress.md` pointed at the OpenAI Agents SDK `Sessions` API as the starting
point. It is not the right tool here, for two reasons:

`Sessions` exists to *persist* conversations. This design keeps conversations
in-session, so it earns nothing. And every session backend the SDK ships
(`sqlalchemy_session`, `redis_session`, `mongodb_session`, and the rest) connects to
its store directly — SQLAlchemy takes a raw Postgres DSN. That bypasses Row Level
Security, which this service makes the single enforcement point for user isolation. A
persistence layer that routes around RLS would be the first hole in that model.

## Short-term: sliding window

A new `agent/window.py` exposing one pure function:

```python
def trim(messages: list, max_messages: int = 20) -> list
```

It lives in `agent/` rather than `api/` because a context budget is a model concern,
and `api/` knows nothing about the model. `agent/run.py` calls it before
`Runner.run_streamed()`.

**The one rule that makes this non-trivial: never orphan a tool call.** If the cut
lands between an assistant message carrying a `tool_call` and its matching
`tool_result`, Groq rejects the request with a 400. The window therefore snaps
backward to a clean user-message boundary rather than cutting at exactly
`max_messages`. The returned list may be shorter than the cap; it is never a broken
pair.

The system prompt is unaffected — the Agents SDK carries it as `instructions`, outside
the message list.

Dropped turns are lost silently. For a finance question-and-answer chat, turn 1 rarely
bears on turn 30, and the alternative (an LLM summarization pass) costs a call, adds
latency, and can hallucinate.

## Long-term: durable facts

### Schema

One migration, applied by hand in the Supabase SQL editor — this project keeps no
local migration directory.

```sql
create table agent_memories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null,
  value      text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

alter table agent_memories enable row level security;

create policy "own memories" on agent_memories
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Why key/value rather than free text.** The unique constraint is the entire dedup
strategy. "I get paid on the 25th" is stored under `payday`. Later, "actually the
30th" reuses that key and the upsert overwrites it. Free-text rows would accumulate
contradictions, and the model would then see both and pick one arbitrarily.

`on delete cascade` means deleting a user takes their memories with them.

### Tools

Two new tools, bringing the total to ten. They go in a new `tools/memory.py` rather
than `tools/finance.py` — that file already holds eight tools, and these are not
finance. This keeps every file under the ~100-line convention.

- `remember_fact(key: str, value: str)` — upsert.
- `forget_fact(key: str)` — hard delete by key.

Both follow the conventions the existing eight established, without exception:
`strict_mode=False` (mandatory; see `agents/memory.md` Gotchas), a
`failure_error_function`, and `asyncio.to_thread` around every synchronous Supabase
call.

The docstring on `remember_fact` is the guard on what gets stored: durable preferences
and personal facts only, never transaction data, never anything already recorded in
the `transactions`, `budgets`, or `profiles` tables.

A new `db/memories.py` provides `list_memories`, `upsert_memory`, and `delete_memory`
as plain synchronous functions, RLS-scoped by the forwarded JWT exactly like every
other query in `db/`. `delete_memory` on an unknown key raises `NotFound`.

### The delete exemption

`agents/README.md` states, twice, that this service cannot delete. That remains true
where it was meant to apply: the destructive capability for financial records does not
exist in this process, and `propose_delete_transaction` still only proposes.

Memories are exempt. `forget_fact` deletes immediately, with no confirmation. The
no-delete rule protects financial records, which are the user's ledger and are painful
to reconstruct. A wrong memory is low-stakes and self-correcting, and routing "stop
remembering my payday" through a confirmation card would be heavier than the thing it
guards.

This exemption is written into `agents/README.md` and `agents/memory.md` so that the
rule keeps its force where it matters, rather than quietly eroding.

### Injection, and the cap

`list_memories(limit=30)` ordered by `updated_at desc` runs once per request.
`agent/prompts.py` formats the rows into a block alongside the existing injected
`today` and category vocabulary:

```
## What you remember about this user
- payday: gets paid on the 25th
- currency_pref: thinks in taka, not dollars
```

When the user has no memories, the block is omitted entirely and the prompt is
byte-identical to today's.

**Why injection rather than a `recall_facts` tool.** A tool is not the cheaper option
at this volume, which is the intuition worth correcting. Its schema occupies the
prompt on every turn whether or not it is used, and each call it makes is a second
round trip that re-sends the full system prompt, the entire conversation, and all ten
tool schemas. Over a ten-turn chat that is several thousand tokens. Injecting thirty
short facts costs roughly 600 tokens per turn — under half a percent of the model's
131k context — and cannot fail the way a tool can, because the model has no
opportunity to forget to ask.

Two caps keep that bound permanent:

- at most 30 rows injected
- `value` truncated to 200 characters on write

Together these hold the block near 600 tokens regardless of how many facts a user
accumulates. Past the cap, the least recently updated facts fall out of the prompt
silently — but the drop is logged. **That log line is the trigger for revisiting
semantic retrieval, and nothing before it is.**

## Error handling

The existing policy holds without change: a failed tool call is data for the model,
not a crash.

- `forget_fact` on an unknown key returns `{"error": ...}`; the model tells the user it
  was not remembering that.
- An RLS denial or a missing table follows the same path as any other typed `db/`
  error.
- **If the injection query fails, log it and continue with no memory block.** Memory is
  an enhancement. It must never take down chat.

## Frontend impact

None. `chat-assistant.tsx` already renders `tool_call` events generically, converting
snake_case to a friendly label (`chat-assistant.tsx:331`), so `remember_fact` displays
as "Running tool: remember fact..." with no change. No new event type is introduced.

## Files

New:

- `agents/src/agent_service/agent/window.py`
- `agents/src/agent_service/db/memories.py`
- `agents/src/agent_service/tools/memory.py`

Modified:

- `agent/prompts.py` — the memory block
- `agent/build.py` — register the two tools
- `agent/run.py` — call `trim()` before the run
- `db/errors.py` — only if a new error type proves necessary
- `agents/README.md`, `agents/memory.md` — the delete exemption and the cap rationale
- `agents/progress.md` — correct the stale Phase 7 status, add this as Phase 9

Applied by hand: the `agent_memories` migration.

## Verification

Manual, end-to-end, against real Groq and real Supabase — the same approach that
surfaced three landmines during Phase 6. No automated tests, consistent with the
decision to remove the previous suite (see Known Gaps in `agents/progress.md`).

1. "remember I get paid on the 25th" — the row lands with the correct `user_id`.
2. In a fresh conversation, "when do I get paid?" — answered with no tool call, which
   proves injection rather than recall.
3. "actually the 30th" — the row is **updated**, not duplicated.
4. "forget my payday" — the row is gone.
5. A conversation long enough to cross the window, containing tool calls — no Groq
   400, which proves the tool-pairing rule.
6. Signed in as a second user, the prompt contains none of the first user's facts.

## Known risk

The cross-user check in step 6 is manual and one-time. RLS is still *enforced* by
Postgres for `agent_memories` as it is for every other table, but as with the rest of
this service, nothing *verifies* it on an ongoing basis. This is the same gap already
recorded in `agents/progress.md`, now extended to one more table.
