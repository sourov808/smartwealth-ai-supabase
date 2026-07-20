"""Routing: one cheap LLM call that names the agent for a message.

Re-exports so callers write `from agent_service import router` and reach
`router.route`, `router.Route`, `router.AGENTS`, `router.NOT_BUILT`.
"""

from agent_service.router.agent import AGENTS, NOT_BUILT, Route, route

__all__ = ["AGENTS", "NOT_BUILT", "Route", "route"]
