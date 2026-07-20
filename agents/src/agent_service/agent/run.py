"""Runs the agent and translates SDK events into our own vocabulary.

The SDK's event stream is rich and provider-shaped. The frontend should not have
to care about that, so this is the one place that knows both languages. It emits
exactly five event types:

    {"type": "tool_call",        "name": str}
    {"type": "confirm_required", "action": str, "transaction": dict}
    {"type": "text",             "content": str}
    {"type": "done"}
    {"type": "error",            "message": str}

It never raises: every failure becomes an `error` event.
"""

from typing import Any, AsyncIterator

from agents import Agent, ItemHelpers, Runner
from agents.exceptions import MaxTurnsExceeded

from agent_service.agent.deps import AgentDeps
from agent_service.agent.window import trim

MAX_TURNS = 8

Event = dict[str, Any]


async def run_agent(
    *,
    agent: Agent[AgentDeps],
    deps: AgentDeps,
    input: str | list,
) -> AsyncIterator[Event]:
    # Short-term memory. A string input is a single turn and needs no window.
    if isinstance(input, list):
        input = trim(input)

    result = Runner.run_streamed(agent, input=input, context=deps, max_turns=MAX_TURNS)

    try:
        async for event in result.stream_events():
            if event.type != "run_item_stream_event":
                # Raw token deltas and agent-handoff events. Not used yet; token
                # streaming would be wired in here.
                continue

            item = event.item

            if event.name == "tool_called":
                yield {
                    "type": "tool_call",
                    "name": getattr(item.raw_item, "name", "unknown"),
                }

            elif event.name == "tool_output":
                # A delete proposal is the one result the UI must act on itself.
                output = item.output
                if isinstance(output, dict) and output.get("requires_confirmation"):
                    yield {
                        "type": "confirm_required",
                        "action": output.get("action"),
                        "transaction": output.get("transaction"),
                    }

            elif event.name == "message_output_created":
                text = ItemHelpers.text_message_output(item)
                if text:
                    yield {"type": "text", "content": text}

            # `reasoning_item_created` is ignored on purpose: gpt-oss is a
            # reasoning model, and its scratchpad is not for the user.

        yield {"type": "done"}

    except MaxTurnsExceeded:
        yield {
            "type": "error",
            "message": (
                "I took too many steps without reaching an answer. "
                "Try asking something more specific."
            ),
        }
    except Exception as exc:  # noqa: BLE001 - surfaced as an event, never a 500
        yield {"type": "error", "message": f"{type(exc).__name__}: {exc}"}
