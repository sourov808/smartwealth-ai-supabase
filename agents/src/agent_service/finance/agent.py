"""The finance agent: the whole trusted, money-touching surface of the service.

One agent rather than the reporter/bookkeeper/budgeteer split that preceded it. A
router picks one handler per turn, so splitting finer loses half of "add coffee 5
and what did I spend on food?".

Six tools, down from eleven across the old three. Schemas are the dominant prompt
cost, so the count is a budget rather than a preference.

**Trusted.** This agent holds every write tool in the service, so it must never be
given untrusted content to read. That is why gmail and notion are separate
packages rather than more tools here.
"""

from agents import Agent

from agent_service.core.context import RequestContext
from agent_service.finance import prompts, tools
from agent_service.core.model import MODEL

agent = Agent[RequestContext](
    name="finance",
    instructions=prompts.finance,
    tools=[
        tools.list_transactions,
        tools.add_transaction,
        tools.update_transaction,
        tools.propose_delete_transaction,
        tools.list_budgets,
        tools.set_budget,
    ],
    model=MODEL,
)
