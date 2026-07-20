# Router Topology — Design

**Date**: 2026-07-20
**Status**: implemented and verified 2026-07-20. See "Measured results".
**Supersedes the topology in**: `2026-07-15-agentic-layer-design.md`
**Related**: `2026-07-20-agent-memory-design.md`

## Problem

The service was refactored from one agent into a manager plus four specialists using
`as_tool`. It works, but it does not fit the account it runs on.

Measured from live Groq response headers:

```
x-ratelimit-limit-tokens:   8000     per minute
x-ratelimit-limit-requests: 1000     per day
```

| | LLM calls/query | tokens/query | queries/min |
|---|---|---|---|
| single agent (before the refactor) | ~2 | ~3,200 | ~2 |
| manager + 4 specialists (current) | 4–8 | 6,000–12,000 | 0–1 |

One delete request consumed the entire per-minute budget and returned 429. Two further
problems in `agents/memory.md` — the manager looping, and the delete guard being unverified —
could not be diagnosed while rate-limited, because every run died before reaching the
behaviour under test.

The provider constraint is fixed: **free-tier Groq, no paid key**. The design must fit inside
8,000 tokens/min rather than argue with it.

## Context that shapes the design

Gmail and Notion integrations are planned next. They are **not** in this spec, but they change
what a correct topology looks like now:

- Email bodies and Notion pages are attacker-controlled input. Any agent that reads them is
  processing untrusted content.
- RLS does not defend against this. RLS stops user A reaching user B's rows. It does not stop
  the user's own agent corrupting the user's own data on instruction from an injected email.
  `agents/memory.md` currently claims RLS is "the backstop against both LLM error and prompt
  injection" — that claim is wrong for injection and must be corrected when this lands.
- Therefore the boundary between trusted and untrusted content should be an **agent boundary**,
  enforced by which tools an agent holds, not by prompt wording.

## Topology

A router selects exactly one leaf agent. No manager, no delegation, no agent-to-agent calls.

```
router  (no tools)  ->  finance | memory | gmail | notion
```

| agent | trust | tools |
|---|---|---|
| finance | trusted | list_transactions, add_transaction, update_transaction, propose_delete_transaction, list_budgets, set_budget |
| memory | trusted | remember_fact, forget_fact |
| gmail | **untrusted, read-only** | *(not in this spec)* |
| notion | **untrusted** | *(not in this spec)* |

`gmail` and `notion` appear in the router enum and nowhere else. This spec builds the seam;
each integration gets its own spec.

### Why one finance agent rather than four specialists

Four fine-grained specialists (reporter/bookkeeper/budgeteer/memoirist) cost ~2,400 tokens per
query versus ~3,600 for a single finance agent. The extra ~1,200 tokens buys three things:

1. **Multi-step finance queries work.** "Add coffee 5 and what did I spend on food?" is one
   agent handling both halves. A router picking a single fine-grained specialist drops one half.
2. **The trust boundary is the agent boundary.** finance/gmail/notion is exactly the
   trusted/untrusted partition. Splitting finance further smears that line for no security gain.
3. **Half the prompts to maintain**, and routing across four near-disjoint vocabularies is far
   more reliable than distinguishing reporter from budgeteer.

### Why a router rather than handoffs

Handoffs still pay for handoff tool schemas on the first call and hand the specialist the full
conversation: ~4,000 tokens/query. A schema-free router call is ~350 tokens because tool schemas
are the dominant cost — measured at ~83% of the prompt — and the router carries none.

## Tool reduction

Tool schemas are the cost driver, not memory (measured: ~83% schemas, ~17% system prompt,
memory under 1%). Eleven tools become six.

| # | change | rationale | tools |
|---|---|---|---|
| 1 | delete `submit_report` | see below | 11→10 |
| 2 | delete `get_profile`; inject currency into context | static per user; removes a schema *and* a round trip | 10→9 |
| 3 | merge `summarize_spending` into `list_transactions(summarize=False)` | the two differ mainly in whether dates are required | 9→8 |
| 4 | move `remember_fact`/`forget_fact` to the memory agent | used ~1 turn in 20, but their schemas rode every finance call | 8→6 |

### `submit_report` is removed

It existed because Groq rejects `output_type` on an agent that has tools
(`400 json mode cannot be combined with tool/function calling`), so structured output had to
travel through a tool signature back to a manager. With the manager gone, its reason is gone.

It is also pure overhead:

- `Report.needs_user_action` is written and never read. `run.py` uses `report.answer` only; the
  confirmation card comes from `context.pending_delete`.
- The agent already emits the same answer as a plain message — `agents/memory.md` records that
  it "says the same thing twice". `run.py` already has `spoken[-1]` as a fallback; that becomes
  the path.
- It costs one schema on every agent plus one extra LLM turn per query.

Removing it also removes `Report`, the `reports` dict, and the `ctx.agent.name` keying subtlety.

## Router design

New module `router.py`.

- An SDK `Agent` with **zero tools** and a prompt of roughly five lines.
- Returns one of `finance | memory | gmail | notion`.
- Any failure — unroutable input, API error, unknown value — falls back to `finance` and logs.
  Routing is an optimization; a bad route must degrade, never fail the request.

### `output_type` does not work, and the reason matters

The design originally called for `output_type=Decision`, reasoning that Groq's restriction —
`400 json mode cannot be combined with tool/function calling` — fires only when tools are
attached, and the router has none. **That was wrong.** It fails differently, on roughly two
calls in three:

```
400 json_validate_failed ... 'failed_generation': ''
```

`gpt-oss` is a reasoning model and Groq's json mode returns empty generations for it, tools or
no tools. The router therefore asks for one bare word and matches it against the enum, which is
also cheaper — no schema in the prompt at all.

**This nearly shipped undetected.** `route()` falls back to `finance` on any exception, so the
service answered every question correctly while routing did nothing at all. The failure was
visible only in a warning log. If routing behaviour ever looks suspiciously uniform, check that
log before trusting it.

## Tool output shaping

Trimming tool *arguments* was only half the problem: tool *results* are what grow the second and
third calls. Every db query is `select("*")`, so each row carried `user_id` — the same value on
every row the caller can see, guaranteed by RLS — and `created_at`, which nobody asks a chat
assistant about.

`models.py` declares `TransactionView` and `BudgetView`, and every tool dumps its rows through
them. The full row still reaches `pending_delete`, because the confirmation card is rendered
from that copy and must not lose fields to a prompt optimization.

Measured saving is ~4% at 18 transactions and scales linearly with rows returned — roughly 8
tokens per row, so ~1,600 tokens on a 200-row result.

## Context window

Topology alone does not fix the budget. Measured per call, before any change:

| source | tokens | set by |
|---|---|---|
| injected memories | ~1,700 | `MAX_INJECTED_MEMORIES=30` × `MAX_MEMORY_VALUE_CHARS=200` (`db.py`) |
| conversation window | ~800–2,000 | `MAX_MESSAGES=20` (`run.py`) |
| tool schemas (6, post-trim) | ~1,000 | derived from type hints |
| instructions | ~180 | `prompts.py` |
| `_CATEGORIES` | ~45 | `prompts.py` |

Instructions are re-sent on every turn, so memories and conversation are paid on **both** calls
of a two-call query. Worst case is 7,400–9,800 tokens per query — still over the 8,000/min limit
*after* the topology change. The caps are not optional.

Two corrections to earlier claims:

- `agents/memory.md` states the memory block "holds near 600 tokens forever". At the cap it is
  ~1,700 (30 rows × 200 chars ≈ 6,750 chars). Off by roughly 3x. Correct it when this lands.
- Prompts are **not** the problem. Each is ~180 tokens and every line traces to an observed
  failure. They are left alone apart from `_FINISH`, which is deleted along with
  `submit_report`. Do not shorten them for token reasons; the saving is noise and the
  regression risk is real.

### Caps

| knob | from | to |
|---|---|---|
| `MAX_MESSAGES` (`run.py`) | 20 | **5** |
| `MAX_INJECTED_MEMORIES` (`db.py`) | 30 | **8** |
| `MAX_MEMORY_VALUE_CHARS` (`db.py`) | 200 | **120** |

`trim()` keeps its forward-snapping behaviour unchanged — the window still cuts on a user
message boundary so a tool_call/tool_result pair can never be orphaned into a Groq 400. At 5
messages that is roughly two prior exchanges plus the live turn.

`MAX_MESSAGES=5` is the trade most likely to need revisiting. `agents/memory.md` argues that for
finance Q&A turn 1 rarely bears on turn 30, which is why no LLM summarization pass is used. If
follow-up questions start losing the thread, raise this first — before touching memories or
schemas.

### Router input

The router receives **only the latest user message**. No conversation history, no memories, no
tool schemas. It returns one name; it needs nothing else. Passing it the window would cost
~2,000 tokens and defeat the point of a schema-free router.

### Memory injection scope

Memories are injected into `finance` and `memory` only. `gmail` and `notion` read
attacker-controlled content and must never receive the user's stored personal facts — that is
the payload an injected email would try to exfiltrate. Cost and security agree here.

## Data flow

```
chat.py    JWT -> RLS-scoped supabase client -> load memories + profile -> RequestContext
router.py  1 call, latest user message only, no tools           ~250-350 tokens
agents.py  the routed agent runs alone, ~2 calls               ~3,800-4,500 tokens
run.py     SDK stream -> 5 event types; pending_delete -> confirm_required
```

| | tokens/query | queries/min |
|---|---|---|
| today | 6,000–12,000 | 0–1 |
| topology change only, caps untouched | 7,400–9,800 | ~1 |
| **topology + caps** | **~4,000–4,800** | **~1.7–2** |

Roughly a 2x improvement, and it fits inside the limit with headroom for a retry. It is not
comfortable. Further reduction, in the order worth trying: rules-based routing to delete the
router call, then Groq prompt caching, then a harder look at the two fat write-tool schemas
(`add_transaction`, `update_transaction`).

## Changes by file

| file | change |
|---|---|
| `router.py` | **new** — `Route` enum, router agent, `route()` |
| `agents.py` | 5 agents → 2 (`finance`, `memory`). Drop every `as_tool`. Drop the manager. |
| `prompts.py` | 5 → 3 (`router`, `finance`, `memory`). Leaf agents now address the **user**, not a manager. |
| `tools.py` | delete `submit_report` and `get_profile`; merge `summarize_spending` into `list_transactions`. |
| `context.py` | drop `Report` and `reports`; add `currency` and `monthly_budget`; keep `pending_delete`. |
| `run.py` | drop the report lookup; `spoken[-1]` becomes the answer path. `MAX_TURNS` 12 → 6. `MAX_MESSAGES` 20 → 5. Fix the stale docstring about sub-agent events. |
| `chat.py` | load the profile beside memories; remove the debug `print`. |
| `db.py` | the profile query stays, now called from `chat.py` rather than from a tool. `MAX_INJECTED_MEMORIES` 30 → 8, `MAX_MEMORY_VALUE_CHARS` 200 → 120. |

## Unchanged decisions

- Reads and writes auto-execute; deletes require confirmation.
- **This service never deletes a transaction.** `propose_delete_transaction` reads the row;
  `run.py` emits `confirm_required`; Next.js performs the delete.
- `forget_fact` remains the one documented exemption.
- `@function_tool(strict_mode=False)` stays mandatory on every tool.
- No retry on transient API errors — they surface as `error` events.
- No service-role key in this service.

## Error handling

Unchanged: every failure becomes an `error` event, never a 500. One addition — router failure is
caught and falls back to `finance` silently.

## Verification

There is no automated test suite, by decision. Verification is therefore manual and must be
explicit. This spec is not done until all four pass:

1. **Token budget.** Measure real prompt tokens per query from response headers, on a query that
   uses tools rather than a trivial one. Target under 5,000. Unmeasured means unfinished —
   reducing tokens is the entire point, and the earlier ~3,600 estimate was wrong because it
   under-counted the conversation window.
2. **Delete guard, on a clean run.** `agents/memory.md` open problem 4: the last attempt held
   the row count at 16, but only because the run crashed on 429 before `confirm_required` could
   be emitted. Needs a run that reaches `confirm_required` with no rate-limit error, row count
   unchanged. This is the safety-critical path.
3. **Loop is gone.** Open problem 3: `['bookkeeper','bookkeeper','bookkeeper']` on one delete
   request. Deleting the manager should make it structurally impossible. Confirm it, do not
   assume it.
4. **Follow-up questions survive `MAX_MESSAGES=5`.** Ask a question, then a follow-up that
   depends on the previous answer ("and what about last month?"). If the thread breaks, raise
   this cap before cutting anything else.

No blockers. The `agent_memories` table exists — the migration was applied on 2026-07-20 and
long-term memory is confirmed working end to end, so the memory agent can be verified as soon
as it is split out.

Note for anyone re-running the DDL: use the copy in `agents/memory.md`. The one in
`2026-07-20-agent-memory-design.md` omits `default auth.uid()` on `user_id` and would fail
not-null on insert.

## Measured results

Run 2026-07-20 against live Groq and Supabase, read-only, on an account with 18 transactions and
2 stored memories. All four verification items pass.

**1. Token budget** — target was under 5,000.

| query | router | agent calls | total prompt tokens |
|---|---|---|---|
| "how much did I spend on food this month?" | 163 | 2 (972, 1076) | **2,211** |
| "delete my most recent transaction" | 158 | 3 (967, 1080, 1226) | **3,431** |

Against 6,000–12,000 before: a 2–3.5x reduction, and both fit inside the 8,000/min ceiling with
room for a retry. The router costs **161 tokens** on average, not the ~350 estimated.

**2. Delete guard, clean run** — `['tool_call', 'tool_call', 'text', 'confirm_required', 'done']`
with tool calls `['list_transactions', 'propose_delete_transaction']`. `confirm_required` was
emitted with no rate-limit error, and the transaction count held at 18 before and after. This is
the first time this path has been verified rather than crashed through.

**3. No loop** — two distinct tool calls, no repeats. The manager that produced
`['bookkeeper','bookkeeper','bookkeeper']` no longer exists.

**4. Follow-ups survive `MAX_MESSAGES=5`** — "how much did I spend on food this month?" followed
by "and what about last month?" correctly resolved the second question against June.

**Routing accuracy: 6/6.** finance ×2, memory ×2, gmail, notion — all correct.

## Out of scope

- Gmail ingestion — separate spec. Must be a background job: ten email bodies is 5,000–15,000
  tokens, which cannot run on the chat request path at this rate limit. Note the 1,000
  requests/day ceiling when designing the poll interval.
- Notion — separate spec. Notion **create** plus email read plus access to private financial
  data is the classic exfiltration combination and needs its own threat model. Cross-boundary
  requests ("check my email for charges and add them") must return *proposed* transactions for
  user confirmation, reusing the existing `pending_delete` → `confirm_required` pattern, rather
  than letting an untrusted-content agent hold write tools.
- Rules-based routing to eliminate the ~350-token router call. Viable once there are only four
  near-disjoint targets, but optimize after it works.
- Groq prompt caching (`memory.md` open problem 5) — unconfirmed and independent of this change.

## Follow-ups this creates

- `agents/README.md` and `agents/progress.md` are already stale (they describe the four-layer
  structure). They will be stale in a second way after this lands.
- `agents/memory.md` needs its security section corrected: RLS is not a defence against prompt
  injection.
- `E2E_EMAIL` / `E2E_PASSWORD` remain in `.env` and should be removed once the frontend chat
  panel is wired up.
