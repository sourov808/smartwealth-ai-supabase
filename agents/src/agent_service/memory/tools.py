"""The memory agent's tools.

Each is a thin adapter: unwrap the context, call db, return a plain dict.
No HTTP, no LLM API details.

Three rules hold for everything below.

1. `strict_mode=False` is MANDATORY. The SDK defaults to True, which breaks this
   design two ways, both verified against live Groq:
     - It forces optional arguments into the schema's `required` list, so the
       model invents values for filters the user never mentioned.
     - `Optional[SomeEnum]` becomes `anyOf: [Enum, null]`, which Groq rejects:
       "400 ... anyOf branches must be disambiguated via a required discriminator"

2. A failed tool call is data for the model, not a crash. `failure_error_function`
   hands the exception back as a tool result the model can act on — it can explain
   the problem or try another approach. Raising would 500 the request.

3. Every db call goes through `asyncio.to_thread`. supabase-py is synchronous, and
   calling it directly from these async functions would block the event loop.

Tool *results* are shaped before they are returned. `select("*")` rows carry
columns the model has no use for, and that cost scales with the result set.
"""

import asyncio

from agents import RunContextWrapper, function_tool

from agent_service.core.context import RequestContext


def _tool_error(ctx: RunContextWrapper, error: Exception) -> str:
    return f"The tool failed: {type(error).__name__}: {error}"


tool = function_tool(strict_mode=False, failure_error_function=_tool_error)

Ctx = RunContextWrapper[RequestContext]

from agent_service.memory import db


# -------------------------------------------------------------------- memories


@tool
async def remember_fact(ctx: Ctx, key: str, value: str) -> dict:
    """Remember a durable fact or preference about the user.

    Reuse an existing key to correct a fact, which replaces the old value rather
    than leaving two contradictory ones.

    Args:
        key: A short snake_case slug naming the fact, e.g. "payday". Reuse the exact key when correcting something already remembered.
        value: The fact itself, in one plain sentence. Truncated past 200 characters.
    """
    row = await asyncio.to_thread(db.upsert_memory, ctx.context.db, key=key, value=value)
    return {"remembered": {"key": row["key"], "value": row["value"]}}


@tool
async def forget_fact(ctx: Ctx, key: str) -> dict:
    """Forget a fact previously remembered about the user.

    To correct a fact, call remember_fact with the same key instead — that
    replaces it in one step.

    Args:
        key: The exact key the fact is stored under.
    """
    row = await asyncio.to_thread(db.delete_memory, ctx.context.db, key=key)
    return {"forgotten": {"key": row["key"]} if row else None}
