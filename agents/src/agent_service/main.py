"""App assembly. Wiring only — no logic lives here."""

from fastapi import FastAPI

from agent_service.agent.tracing import configure_tracing
from agent_service.api.chat import router as chat_router

app = FastAPI(title="Agent Service", version="0.1.0")
app.include_router(chat_router)

# After the router import, which pulls in agent/model.py and its
# import-time set_tracing_disabled(True). This call is what overrides it.
configure_tracing()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
