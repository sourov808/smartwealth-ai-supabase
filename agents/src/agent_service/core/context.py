"""The per-request context, shared by the router and the routed agent.

The Agents SDK passes whatever object you give `Runner.run(context=...)` through
to every tool as `RunContextWrapper.context`. That is how one RLS-scoped Supabase
client reaches the tools without any global state.

It is also the return channel for anything a tool needs to tell run.py that does
not fit in a tool's string result. Today that is one thing: `pending_delete`.

`pending_delete` is written by the tool itself, never by the model. That matters:
the frontend's confirmation card needs the real row, and a model asked to retype
it into a tool argument could mistype an amount. Code copies it; the model only
decides whether to ask.

`currency` is read once per request in chat.py and injected into the prompt. It
was a `get_profile` tool until the router refactor, which cost a schema on every
call plus a round trip to answer "which currency?" — a question whose answer
cannot change mid-conversation.

`Report` and `reports` are gone with `submit_report`. They existed to carry
structured output back to a manager agent; there is no manager now, and the
agent's own message is the answer. See run.py.

One RequestContext per request. Never share one across users.
"""

from dataclasses import dataclass, field
from typing import Optional

from supabase import Client


@dataclass
class RequestContext:
    db: Client
    today: str  # ISO date. The model has no clock; see each agent's prompts.py.
    # The caller's Supabase JWT, forwarded to Next.js so it can mint a Gmail
    # access token for this user. Nothing else reads it: every database query
    # goes through `db`, which already carries the same token. Held here rather
    # than threaded through tool arguments so the model can never see or alter
    # it.
    jwt: str
    currency: str = "USD"
    memories: list[dict] = field(default_factory=list)
    pending_delete: Optional[dict] = None

    def memories_block(self) -> str:
        """Render stored facts for a system prompt. No facts means no heading.

        Lives here rather than in a helper module because it is the only thing
        that renders `memories`, and both agents that inject it reach it through
        this object anyway. `db.py` holds the caps that bound its size.
        """
        if not self.memories:
            return ""
        lines = "\n".join(f"- {m['key']}: {m['value']}" for m in self.memories)
        return f"\n\nYou remember about this user:\n{lines}"
