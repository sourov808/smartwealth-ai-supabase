"""Picks which agent handles a message. One cheap LLM call, no tools.

This replaces a manager agent that delegated via `as_tool`. The manager cost
4-8 LLM calls and 6,000-12,000 tokens per query against a free-tier Groq ceiling
of 8,000 tokens per minute, so a single delete request exhausted the budget and
429'd. Routing does the same job in one call of roughly 300 tokens.

Two things make it cheap, and both matter:

1. **No tools.** Tool schemas were measured at ~83% of the prompt. The router
   carries none, so it pays for its instructions and nothing else. Attaching a
   tool here would defeat the entire design.

2. **Only the latest user message.** Not the conversation window, not the
   memories. It picks a name; it needs nothing else. Passing it the window would
   cost ~2,000 tokens instead of ~300.

**`output_type` does not work here, despite there being no tools.** The obvious
design was a pydantic `output_type`, on the reasoning that Groq's restriction —

    400 json mode cannot be combined with tool/function calling

— fires only when tools are attached. It does not fail that way. It fails this
way, on roughly two calls in three:

    400 json_validate_failed ... 'failed_generation': ''

`gpt-oss` is a reasoning model and Groq's json mode returns empty generations for
it. Measured, not recalled. So the router asks for one bare word and matches it
against the enum. That is also cheaper: no schema at all in the prompt.

The failure was invisible at first because `route()` falls back to `finance` on
any exception — the service answered every question and looked fine while routing
was doing nothing. If routing behaviour ever looks suspiciously uniform, check
the warning log before trusting it.

Routing is an optimization, never a gate. Every failure path here — API error,
unparseable result, a route with no agent behind it — falls back to `finance` and
logs. A bad route gives a worse answer; a raised exception gives none.
"""

import logging
from enum import StrEnum

from agents import Agent, Runner

from agent_service.core.context import RequestContext
from agent_service.core.model import MODEL
from agent_service.finance.agent import agent as finance
from agent_service.gmail.agent import agent as gmail
from agent_service.memory.agent import agent as memory
from agent_service.router import prompts

log = logging.getLogger(__name__)

class Route(StrEnum):
    FINANCE = "finance"
    MEMORY = "memory"
    GMAIL = "gmail"
    NOTION = "notion"


# `gmail` runs on the chat request path after all. The earlier design assumed it
# could not — ten email *bodies* is 5,000-15,000 tokens against an 8,000/min
# ceiling — but that assumed the LLM had to read the bodies. It does not: Gmail's
# search query does the finding for zero tokens, and `format=metadata` returns
# Google's own plain-text snippet, so eight messages cost ~640 tokens rather than
# ~4,800. See gmail/client.py. Background ingestion is still the right shape for
# unattended scanning; it is not needed to answer a question the user just asked.
#
# `notion` stays unbuilt. It needs write access to be useful, and write access
# plus email reading plus private financial data is the classic exfiltration
# combination — it gets its own threat model before it gets code.
AGENTS: dict[Route, Agent[RequestContext]] = {
    Route.FINANCE: finance,
    Route.GMAIL: gmail,
    Route.MEMORY: memory,
}

NOT_BUILT = {
    Route.NOTION: "I can't reach your Notion yet — that isn't wired up.",
}

_router = Agent(
    name="router",
    instructions=prompts.INSTRUCTIONS,
    model=MODEL,
)


def _parse(text: str) -> Route:
    """Match the model's reply against the enum.

    A reasoning model sometimes wraps the answer in a sentence, so this looks for
    a route name anywhere in the reply rather than demanding an exact match.
    Longest names first: "gmail" cannot be a substring of another route, but
    keeping the order explicit means a future route that *is* a substring will
    not silently shadow one.
    """
    lowered = text.strip().lower()
    for route in sorted(Route, key=lambda r: -len(r.value)):
        if route.value in lowered:
            return route
    raise ValueError(f"No route found in reply: {text[:120]!r}")


async def route(message: str) -> Route:
    """Choose a handler for one user message.

    Takes the message alone, not a RequestContext — a reminder in the signature
    that this call sees no memories and no history.
    """
    try:
        result = await Runner.run(_router, input=message, max_turns=1)
        return _parse(result.final_output)
    except Exception as exc:  # noqa: BLE001 - routing must never fail the request
        log.warning("Routing failed, falling back to finance: %s", exc)
        return Route.FINANCE
