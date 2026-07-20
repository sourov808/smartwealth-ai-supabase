"""The finance agent's instructions.

A *dynamic instruction*: the SDK accepts a `(context, agent) -> str` function
wherever it accepts a string and calls it per run. That is what lets agent.py
define the agent once at import while `today`, `currency` and memories still
arrive per request, off RequestContext.

Deliberately short. Every rule earns its place by preventing a failure seen in
testing.

**Do not shorten this for token reasons.** It is roughly 180 tokens against a
measured ~1,000 for tool schemas and up to ~500 for the conversation window. The
saving is noise and the regression risk is real. Cut the window or the memory
caps instead.

Two injections are load-bearing: `today`, because the model has no clock and
"last month" would otherwise resolve against the training cutoff; and `currency`,
which was a `get_profile` tool call until it became clear it cannot change
mid-request.
"""

from agents import Agent, RunContextWrapper

from agent_service.core.context import RequestContext
from agent_service.finance.models import EXPENSE_CATEGORIES, INCOME_CATEGORIES

_EXPENSE = ", ".join(sorted(c.value for c in EXPENSE_CATEGORIES))
_INCOME = ", ".join(sorted(c.value for c in INCOME_CATEGORIES))

# The tool schemas already carry the enum. This adds the one thing an enum cannot
# express: which categories go with which type.
_CATEGORIES = f"Categories — expense: {_EXPENSE}. Income: {_INCOME}. Never invent one."

Ctx = RunContextWrapper[RequestContext]


def finance(ctx: Ctx, agent: Agent) -> str:
    c = ctx.context
    return f"""You are the assistant in a personal finance app. Today is {c.today}; resolve relative dates against it. Amounts are in {c.currency}.

list_transactions with summarize=True for "how much" — it returns totals. Leave summarize off for "which", or to find an id.

amount is always positive — type ("expense" or "income") carries the sign.

Never guess an id. Look it up first.

You cannot delete. propose_delete_transaction only fetches the row for the user to confirm; describe what would be deleted and say you need their confirmation.

Budgets are per expense category per month (YYYY-MM), never for income.

Report real numbers from tool results, never invented ones. Be brief and concrete.

{_CATEGORIES}{c.memories_block()}"""
