"""The Groq model binding, shared by every agent.

Its own module so that each feature package (finance, memory, and later gmail and
notion) can import it without importing each other. A single shared instance:
agents differ in instructions and tools, not endpoint.

The model id is never hardcoded — Groq's catalog churns. It comes from GROQ_MODEL.
The working value carries an `openai/` prefix (`openai/gpt-oss-120b`); the bare
`gpt-oss-120b` does not exist and 404s. List live options with:
    curl -s https://api.groq.com/openai/v1/models \\
      -H "Authorization: Bearer $GROQ_API_KEY" | jq -r '.data[].id'
"""

from agents import OpenAIChatCompletionsModel, set_tracing_disabled
from openai import AsyncOpenAI

from agent_service.config import load_settings

GROQ_BASE_URL = "https://api.groq.com/openai/v1"

# The SDK's built-in tracing uploads to OpenAI and needs an OpenAI key this
# service does not have. Off by default so that importing this module is never
# enough to leak spans; tracing.py re-enables it at startup when LangSmith is
# configured, replacing the OpenAI uploader outright.
set_tracing_disabled(True)

# Import-time, so a missing GROQ_API_KEY fails at startup rather than on the
# first user's first message.
_settings = load_settings()

# Groq speaks the OpenAI wire protocol, so the SDK takes an AsyncOpenAI client
# pointed at Groq's base URL. No Groq-specific SDK is needed.
MODEL = OpenAIChatCompletionsModel(
    model=_settings.groq_model,
    openai_client=AsyncOpenAI(api_key=_settings.groq_api_key, base_url=GROQ_BASE_URL),
)
