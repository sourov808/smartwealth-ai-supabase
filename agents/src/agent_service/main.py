"""App assembly. Wiring only — no logic lives here."""

from fastapi import FastAPI

from agent_service.api.chat import router as chat_router

app = FastAPI(title="Agent Service", version="0.1.0")
app.include_router(chat_router)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
