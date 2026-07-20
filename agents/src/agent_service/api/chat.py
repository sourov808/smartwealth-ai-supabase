"""POST /chat — the only real endpoint."""

import asyncio
import json
import logging
from datetime import date
from typing import AsyncIterator, Literal

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agent_service.agent.build import build_agent
from agent_service.agent.deps import AgentDeps
from agent_service.agent.run import run_agent
from agent_service.api.deps import get_jwt
from agent_service.config import load_settings
from agent_service.db import memories as mem
from agent_service.db.client import create_user_client

router = APIRouter()
log = logging.getLogger(__name__)


async def _load_memories(db) -> list[dict]:
    """Long-term memory is an enhancement. It must never take down chat.

    A missing table, an RLS refusal, or an unreachable database here degrades
    the agent to the behaviour it had before memory existed, and logs why.
    """
    try:
        rows = await asyncio.to_thread(mem.list_memories, db)
    except Exception as exc:  # noqa: BLE001 - degrade, never fail the request
        log.warning("Memory unavailable, continuing without it: %s", exc)
        return []

    if len(rows) == mem.MAX_INJECTED:
        # The cap is now discarding facts. This line is the signal that
        # retrieval is worth designing; nothing before it is.
        log.info("Memory cap of %d reached; older facts are being dropped.", mem.MAX_INJECTED)

    return rows


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    # Conversation state lives in the frontend and is resent every turn.
    messages: list[Message] = Field(min_length=1)


def _sse(event: dict) -> str:
    return f"data: {json.dumps(event, default=str)}\n\n"


@router.post("/chat")
async def chat(request: ChatRequest, jwt: str = Depends(get_jwt)) -> StreamingResponse:
    settings = load_settings()
    today = date.today().isoformat()

    db = create_user_client(settings, jwt)
    deps = AgentDeps(db=db, today=today)
    agent = build_agent(settings, today=today, memories=await _load_memories(db))

    print("agent", agent)   

    async def stream() -> AsyncIterator[str]:
        try:
            async for event in run_agent(
                agent=agent,
                deps=deps,
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
