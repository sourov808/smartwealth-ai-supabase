"""The per-request context handed to every tool.

The Agents SDK passes whatever object you give `Runner.run(context=...)` through
to each tool as `RunContextWrapper.context`. That is how the caller's RLS-scoped
Supabase client reaches the tools without any global state.

One AgentDeps per request. Never share one across users.
"""

from dataclasses import dataclass

from supabase import Client


@dataclass
class AgentDeps:
    db: Client
    today: str  # ISO date. The model has no clock; see agent/prompts.py.
