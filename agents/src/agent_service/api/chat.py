"""POST /chat — the only real endpoint."""

import json
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
from agent_service.db.client import create_user_client

router = APIRouter()


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

    deps = AgentDeps(db=create_user_client(settings, jwt), today=today)
    agent = build_agent(settings, today=today)

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
