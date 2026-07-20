"""The two long-term memory tools.

Separate from `finance.py` because these are not finance, and that file already
holds eight tools. Same two rules apply here as there — `strict_mode=False` on
every tool, and `asyncio.to_thread` around every sync supabase call.

`forget_fact` deletes for real, which is the one exemption from this service's
no-delete rule. That rule protects financial records: a ledger is painful to
reconstruct, so `propose_delete_transaction` still only proposes. A wrong memory
is low-stakes and self-correcting, and routing "stop remembering my payday"
through a confirmation card would weigh more than the thing it guards.
"""

import asyncio

from agents import RunContextWrapper

from agent_service.agent.deps import AgentDeps
from agent_service.db import memories as mem
from agent_service.tools.base import tool


@tool
async def remember_fact(ctx: RunContextWrapper[AgentDeps], key: str, value: str) -> dict:
    """Remember a durable fact or preference about the user.

    Use this when the user tells you something that will still be true next
    week and that you would otherwise forget — how they are paid, what they
    call things, how they like answers phrased.

    Do NOT use this for anything the database already holds. Transactions,
    budgets, and profile settings have their own tools; storing them here would
    create a second copy that silently goes stale.

    Reuse an existing key to correct a fact. "Actually I get paid on the 30th"
    should reuse the key you already stored the payday under, which replaces the
    old value rather than leaving two contradictory ones.

    Args:
        key: A short snake_case slug naming the fact, e.g. "payday" or "currency_pref". Reuse the exact key when correcting something you already remember.
        value: The fact itself, in one plain sentence. Truncated past 200 characters.
    """
    row = await asyncio.to_thread(mem.upsert_memory, ctx.context.db, key=key, value=value)
    return {"remembered": row}


@tool
async def forget_fact(ctx: RunContextWrapper[AgentDeps], key: str) -> dict:
    """Forget a fact you previously remembered about the user.

    Use this only when the user asks you to forget something. To *correct* a
    fact, call remember_fact with the same key instead — that replaces it in one
    step.

    Args:
        key: The exact key the fact is stored under. It appears beside the fact in what you remember about this user.
    """
    row = await asyncio.to_thread(mem.delete_memory, ctx.context.db, key=key)
    return {"forgotten": row}


MEMORY_TOOLS = [remember_fact, forget_fact]
