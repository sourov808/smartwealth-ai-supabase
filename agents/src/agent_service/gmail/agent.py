"""The gmail agent: the untrusted-content side of the trust boundary.

One tool, read-only. finance/agent.py holds every write tool in the service and
must never read a stranger's text; this agent reads strangers' text and must
never hold a write tool. Keeping them in separate packages is what makes that
statement checkable by looking at two `tools=[...]` lists rather than by reading
prompts.

Adding a write tool here would defeat the design of the whole package. If a
future feature seems to need one, it belongs on the finance agent with the user
routed to it, not here.
"""

from agents import Agent

from agent_service.core.context import RequestContext
from agent_service.core.model import MODEL
from agent_service.gmail import prompts, tools

agent = Agent[RequestContext](
    name="gmail",
    instructions=prompts.gmail,
    tools=[tools.search_email],
    model=MODEL,
)
