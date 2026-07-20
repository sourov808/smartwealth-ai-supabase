"""Short-term memory: a sliding window over the conversation.

The frontend holds the message array and resends it every turn, so a long chat
grows without bound. This trims it before the model ever sees it.

It lives here rather than in `api/` because a context budget is a model concern,
and `api/` knows nothing about the model.

Deliberately not an LLM summarization pass: that costs a call, adds latency, and
can hallucinate. For a finance Q&A chat, turn 1 rarely bears on turn 30.
"""

from typing import Any

MAX_MESSAGES = 20


def _is_user(message: Any) -> bool:
    return isinstance(message, dict) and message.get("role") == "user"


def trim(messages: list, max_messages: int = MAX_MESSAGES) -> list:
    """Keep the most recent messages, cutting on a user-message boundary.

    The cut snaps *forward* to the next user message rather than slicing at
    exactly `max_messages`. Two reasons:

    1. A window that opens mid-exchange reads as though the user asked nothing.
    2. If the input ever carries tool items — it does not today, `api/chat.py`
       accepts role/content only — slicing between a tool call and its result
       makes Groq reject the request with a 400. Snapping cannot orphan a pair.

    The result may therefore be shorter than `max_messages`. It is never broken.
    Returns the input unchanged when it already fits.
    """
    if len(messages) <= max_messages:
        return messages

    window = messages[-max_messages:]

    for i, message in enumerate(window):
        if _is_user(message):
            return window[i:]

    # No user message in the window at all — an unusual shape we should not
    # guess at. Fall back to the last message, which is the live turn.
    return messages[-1:]
