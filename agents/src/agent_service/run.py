"""Runs the routed agent and translates SDK events into our own vocabulary.

The SDK's event stream is rich and provider-shaped. The frontend should not have
to care about that, so this is the one place that knows both languages. It emits
exactly five event types:

    {"type": "tool_call",        "name": str}
    {"type": "confirm_required", "action": str, "transaction": dict}
    {"type": "text",             "content": str}
    {"type": "done"}
    {"type": "error",            "message": str}

It never raises: every failure becomes an `error` event.

One agent runs per request, chosen by router.py. There are no sub-agents, so
`tool_call` carries real tool names again ("add_transaction") rather than the
specialist names the manager design produced.

The delete confirmation still comes from `ctx.pending_delete` rather than from a
tool's output event. That was originally a workaround for sub-agent output not
reaching this stream; it is kept because it is simply the safer source. The card
must show the stored row, not a number the model retyped into an argument.
"""

from typing import Any, AsyncIterator

from agents import Agent, ItemHelpers, Runner
from agents.exceptions import MaxTurnsExceeded

from agent_service.core.context import RequestContext

# One agent, no delegation turns. Was 12 for the manager design; a leaf agent
# needs a tool call and an answer, with headroom for a correction.
MAX_TURNS = 6

Event = dict[str, Any]

# The single tightest knob in the service. Was 20, measured at ~800-2,000 tokens
# — and instructions are re-sent every turn, so it was paid on both calls of a
# query against a free-tier ceiling of 8,000 tokens per minute. At 5 this is
# roughly two prior exchanges plus the live turn.
#
# This is the first thing to raise if follow-up questions start losing the
# thread, ahead of the memory caps in db.py.
MAX_MESSAGES = 5


def trim(messages: list, max_messages: int = MAX_MESSAGES) -> list:
    """Short-term memory: keep the most recent messages, cut on a user boundary.

    The frontend holds the conversation and resends it every turn, so it grows
    without bound. This is the only thing that stops it.

    The cut snaps *forward* to the next user message rather than slicing at
    exactly `max_messages`. Two reasons:

    1. A window opening mid-exchange reads as though the user asked nothing.
    2. If the input ever carries tool items — it does not today, chat.py accepts
       role/content only — slicing between a tool call and its result makes Groq
       reject the request with a 400. Snapping cannot orphan a pair.

    The result may be shorter than `max_messages`. It is never broken. Returns
    the input unchanged when it already fits.

    Deliberately not an LLM summarization pass: that costs a call, adds latency,
    and can hallucinate. For a finance Q&A chat, turn 1 rarely bears on turn 30.
    """
    if len(messages) <= max_messages:
        return messages

    window = messages[-max_messages:]

    for i, message in enumerate(window):
        if isinstance(message, dict) and message.get("role") == "user":
            return window[i:]

    # No user message in the window at all — an unusual shape we should not guess
    # at. Fall back to the last message, which is the live turn.
    return messages[-1:]


async def run_agent(
    *,
    agent: Agent[RequestContext],
    context: RequestContext,
    input: str | list,
) -> AsyncIterator[Event]:
    if isinstance(input, list):
        input = trim(input)

    result = Runner.run_streamed(agent, input=input, context=context, max_turns=MAX_TURNS)

    try:
        spoken: list[str] = []

        async for event in result.stream_events():
            if event.type != "run_item_stream_event":
                # Raw token deltas and agent-handoff events. Not used yet; token
                # streaming would be wired in here.
                continue

            if event.name == "tool_called":
                yield {
                    "type": "tool_call",
                    "name": getattr(event.item.raw_item, "name", "unknown"),
                }

            elif event.name == "message_output_created":
                # Buffered rather than emitted as it arrives, so that only the
                # final message reaches the user — an agent that calls a tool
                # mid-run may narrate before it has the answer.
                text = ItemHelpers.text_message_output(event.item)
                if text:
                    spoken.append(text)

            # `reasoning_item_created` is ignored on purpose: gpt-oss is a
            # reasoning model, and its scratchpad is not for the user.

        # The agent's own last message is the answer. This used to prefer a
        # `submit_report` tool result, which existed to carry structured output
        # back to a manager agent; with no manager it was one extra schema and
        # one extra turn to restate what the model had already said.
        if spoken:
            yield {"type": "text", "content": spoken[-1]}

        # After the text, so the UI has the explanation before the card.
        if context.pending_delete:
            yield {
                "type": "confirm_required",
                "action": "delete_transaction",
                "transaction": context.pending_delete,
            }

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
