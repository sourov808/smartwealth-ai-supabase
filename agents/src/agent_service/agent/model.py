"""Binds the Agents SDK to Groq.

Groq speaks the OpenAI wire protocol, so we hand the SDK an AsyncOpenAI client
pointed at Groq's base URL. No Groq-specific SDK is needed.

The model id is never hardcoded — Groq's catalog churns. It comes from
GROQ_MODEL. Note the working value carries an `openai/` prefix
(`openai/gpt-oss-120b`); the bare `gpt-oss-120b` does not exist and 404s. List
live options with:
    curl -s https://api.groq.com/openai/v1/models \\
      -H "Authorization: Bearer $GROQ_API_KEY" | jq -r '.data[].id'
"""

from agents import OpenAIChatCompletionsModel, set_tracing_disabled
from openai import AsyncOpenAI

from agent_service.config import Settings

GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# The SDK's built-in tracing uploads to OpenAI and needs an OpenAI API key, which
# this service does not have. Off by default so that importing this module is
# never enough to leak spans. `agent/tracing.py` re-enables it at startup when
# LangSmith is configured, replacing the OpenAI uploader outright.
set_tracing_disabled(True)


def create_model(settings: Settings) -> OpenAIChatCompletionsModel:
    return OpenAIChatCompletionsModel(
        model=settings.groq_model,
        openai_client=AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url=GROQ_BASE_URL,
        ),
    )
