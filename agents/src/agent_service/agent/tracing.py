"""LangSmith tracing for the agent loop.

The Agents SDK emits spans for every run, tool call, and model request. By
default it ships them to OpenAI's own tracing backend, which needs an OpenAI API
key this service does not have — hence the `set_tracing_disabled(True)` that
`agent/model.py` applies at import time.

This module reverses that when LangSmith is configured. `set_trace_processors`
*replaces* the processor list rather than appending to it, so enabling LangSmith
also removes the OpenAI uploader. No span ever reaches OpenAI.

Tracing is optional by design. A missing key, a missing package, or
LANGSMITH_TRACING unset leaves the service in exactly the state it was in
before: running, untraced, and saying so once in the log. Observability must
never be the reason chat is down.

Environment (all read by the LangSmith client itself, not by config.py):
    LANGSMITH_TRACING=true      the switch this module reads
    LANGSMITH_API_KEY           required when the switch is on
    LANGSMITH_PROJECT           optional, defaults to LangSmith's "default"
    LANGSMITH_ENDPOINT          optional, for self-hosted or EU deployments

PRIVACY: spans carry the full prompt and every tool result, which here means one
user's real transactions, budgets, and remembered facts leaving this process for
a third party. That is the trade tracing makes. If it is not acceptable for
production, construct the processor with a `langsmith.Client(hide_inputs=...,
hide_outputs=...)` rather than turning the feature off wholesale.
"""

import logging
import os

from agents import set_trace_processors, set_tracing_disabled

from agent_service.config import load_env

log = logging.getLogger(__name__)

TRUTHY = {"1", "true", "yes", "on"}


def configure_tracing() -> bool:
    """Point the SDK at LangSmith. Returns whether tracing ended up enabled.

    Safe to call once at startup. Never raises.
    """
    load_env()

    if os.environ.get("LANGSMITH_TRACING", "").strip().lower() not in TRUTHY:
        log.info("LANGSMITH_TRACING is not set; running untraced.")
        return False

    if not os.environ.get("LANGSMITH_API_KEY", "").strip():
        log.warning("LANGSMITH_TRACING is on but LANGSMITH_API_KEY is empty; running untraced.")
        return False

    try:
        from langsmith.wrappers import OpenAIAgentsTracingProcessor
    except ImportError:
        log.warning("langsmith is not installed; running untraced. Try: uv add langsmith")
        return False

    try:
        set_trace_processors([OpenAIAgentsTracingProcessor()])
    except Exception as exc:  # noqa: BLE001 - tracing must never break startup
        log.warning("Could not start LangSmith tracing, running untraced: %s", exc)
        return False

    # Undoes model.py's import-time default. Order matters: model.py is imported
    # first, through build_agent, so this call is the one that wins.
    set_tracing_disabled(False)

    project = os.environ.get("LANGSMITH_PROJECT", "").strip() or "default"
    log.info("LangSmith tracing enabled, project %r.", project)
    return True
