"""The memory agent: durable facts about the user, and nothing else.

Split out from finance for one measured reason. Its tools are used about one turn
in twenty, but folded into finance their schemas rode every single call. "Remember
that…" and "forget that…" route on near-unambiguous phrasing, so the split is
close to free.
"""

from agents import Agent

from agent_service.core.context import RequestContext
from agent_service.memory import prompts, tools
from agent_service.core.model import MODEL

agent = Agent[RequestContext](
    name="memory",
    instructions=prompts.memory,
    tools=[tools.remember_fact, tools.forget_fact],
    model=MODEL,
)
