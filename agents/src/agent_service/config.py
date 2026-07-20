"""Environment loading. Every setting is required; there are no silent defaults."""

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


@dataclass(frozen=True)
class Settings:
    groq_api_key: str
    groq_model: str
    supabase_url: str
    supabase_anon_key: str
    # Where the Next.js app lives. The gmail agent asks it for an access token
    # rather than holding Google credentials itself — see gmail/client.py.
    app_base_url: str
    # Proves to that endpoint that the caller is this service and not a browser.
    agent_service_secret: str


def load_env() -> None:
    """Real env vars win over the file, so deployment can override it."""
    load_dotenv(ENV_FILE, override=False)


def _require(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {name}. See agents/.env"
        )
    return value


def load_settings() -> Settings:
    load_env()
    return Settings(
        groq_api_key=_require("GROQ_API_KEY"),
        groq_model=_require("GROQ_MODEL"),
        supabase_url=_require("SUPABASE_URL"),
        supabase_anon_key=_require("SUPABASE_ANON_KEY"),
        app_base_url=_require("APP_BASE_URL").rstrip("/"),
        agent_service_secret=_require("AGENT_SERVICE_SECRET"),
    )
