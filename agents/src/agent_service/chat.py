"""POST /chat — the only real endpoint.

The JWT's signature is deliberately NOT verified here. Supabase verifies it on
every PostgREST request, and a forged token simply fails there. Verifying twice
would mean holding the JWT secret in this service for no added protection. This
layer only extracts the token; the database decides whether it is real.
"""

import asyncio
import json
import logging
from datetime import date
from typing import AsyncIterator, Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from supabase import Client

from agent_service import router as routing
from agent_service.core import db
from agent_service.config import load_settings
from agent_service.core.context import RequestContext
from agent_service.finance import db as finance_db
from agent_service.memory import db as memory_db
from agent_service.run import run_agent

router = APIRouter()
log = logging.getLogger(__name__)


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    # Conversation state lives in the frontend and is resent every turn.
    messages: list[Message] = Field(min_length=1)


def get_jwt(authorization: str = Header(default="")) -> str:
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(
            status_code=401,
            detail="Expected an 'Authorization: Bearer <jwt>' header",
        )
    return token.strip()


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


async def _load_memories(client: Client) -> list[dict]:
    """Long-term memory is an enhancement. It must never take down chat.

    A missing table, an RLS refusal, or an unreachable database here degrades the
    agents to the behaviour they had before memory existed, and logs why.
    """
    try:
        rows = await asyncio.to_thread(memory_db.list_memories, client)
    except Exception as exc:  # noqa: BLE001 - degrade, never fail the request
        log.warning("Memory unavailable, continuing without it: %s", exc)
        return []

    if len(rows) == memory_db.MAX_INJECTED_MEMORIES:
        # The cap is now discarding facts. This line is the signal that retrieval
        # is worth designing; nothing before it is.
        log.info("Memory cap of %d reached; older facts are being dropped.",
                 memory_db.MAX_INJECTED_MEMORIES)

    return rows


async def _load_currency(client: Client) -> str:
    """The user's currency, injected into the prompt.

    This was a `get_profile` tool. It cannot change mid-request, so as a tool it
    cost a schema on every call plus a round trip to answer a fixed question.
    Same degrade-never-fail rule as memory: a missing profile row falls back to
    USD rather than failing the request.
    """
    try:
        profile = await asyncio.to_thread(finance_db.get_profile, client)
    except Exception as exc:  # noqa: BLE001 - degrade, never fail the request
        log.warning("Profile unavailable, defaulting to USD: %s", exc)
        return "USD"

    return profile.get("currency") or "USD"


@router.post("/chat")
async def chat(request: ChatRequest, jwt: str = Depends(get_jwt)) -> StreamingResponse:
    settings = load_settings()
    client = db.create_user_client(settings, jwt)

    # The router sees this one message and nothing else — no history, no
    # memories, no tool schemas. That is what keeps it to roughly 300 tokens.
    latest = request.messages[-1].content

    async def stream() -> AsyncIterator[str]:
        try:
            # Routing happens before the context is built, because what the
            # context is allowed to contain depends on where the message is
            # going. Loading memories first and withholding them later would
            # work, but this way the gmail path never has them in the process at
            # all.
            route = await routing.route(latest)

            # notion is routable but unbuilt. Saying so plainly costs nothing and
            # beats handing the question to an agent that will confidently answer
            # it with the wrong tools.
            unbuilt = routing.NOT_BUILT.get(route)
            if unbuilt:
                yield _sse({"type": "text", "content": unbuilt})
                yield _sse({"type": "done"})
                return

            # The gmail agent reads attacker-controlled text. The user's stored
            # facts are exactly what an injected email would try to make it
            # repeat, so that route is never given them. gmail/prompts.py also
            # declines to render them; this is the half that makes it true rather
            # than merely intended.
            memories = [] if route is routing.Route.GMAIL else await _load_memories(client)

            context = RequestContext(
                db=client,
                today=date.today().isoformat(),
                jwt=jwt,
                currency=await _load_currency(client),
                memories=memories,
            )

            async for event in run_agent(
                agent=routing.AGENTS[route],
                context=context,
                input=[m.model_dump() for m in request.messages],
            ):
                yield _sse(event)
        except Exception as exc:  # noqa: BLE001
            # Headers are already sent, so we cannot switch to a 500 here. The
            # client learns about failures through the event stream instead.
            yield _sse({"type": "error", "message": f"{type(exc).__name__}: {exc}"})

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
