"""The eight tools the agent can call.

Each one is a thin adapter: unwrap the context, call `db/`, return a plain dict.
No HTTP, no LLM API details.

Every tool is built with the `tool` decorator from `base.py`, which is where
`strict_mode=False` and the error policy are explained — both are load-bearing.

The rule `base.py` cannot enforce: every db call goes through `asyncio.to_thread`.
supabase-py is synchronous, and calling it directly from these async functions
would block the event loop.
"""

import asyncio
from collections import defaultdict
from typing import Optional

from agents import RunContextWrapper

from agent_service.agent.deps import AgentDeps
from agent_service.db import budgets as bg
from agent_service.db import profiles as pf
from agent_service.db import transactions as tx
from agent_service.models import (
    Category,
    GroupBy,
    RecurringInterval,
    TransactionType,
    check_category_matches_type,
)
from agent_service.tools.base import tool


@tool
async def list_transactions(
    ctx: RunContextWrapper[AgentDeps],
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[Category] = None,
    type: Optional[TransactionType] = None,
    limit: int = 50,
) -> dict:
    """List the user's transactions, newest first.

    Use this to find a specific transaction, or to answer "which" questions.
    For "how much" questions, prefer summarize_spending.

    Args:
        start_date: Only include transactions on or after this ISO date (YYYY-MM-DD). Omit for no lower bound.
        end_date: Only include transactions on or before this ISO date (YYYY-MM-DD). Omit for no upper bound.
        category: Only include this one category. Omit unless the user named a specific category.
        type: Only include expenses, or only income. Omit for both.
        limit: Maximum rows to return, 1-200.
    """
    rows = await asyncio.to_thread(
        tx.list_transactions,
        ctx.context.db,
        start_date=start_date,
        end_date=end_date,
        category=category.value if category else None,
        type=type.value if type else None,
        limit=max(1, min(limit, 200)),
    )
    return {"transactions": rows, "count": len(rows)}


@tool
async def summarize_spending(
    ctx: RunContextWrapper[AgentDeps],
    start_date: str,
    end_date: str,
    group_by: GroupBy,
) -> dict:
    """Total the user's transactions over a date range, grouped.

    Prefer this over list_transactions when the user asks "how much" rather than
    "which".

    Args:
        start_date: Start of the range, ISO date (YYYY-MM-DD).
        end_date: End of the range, ISO date (YYYY-MM-DD).
        group_by: Group totals by category, by type (income vs expense), or by month.
    """
    rows = await asyncio.to_thread(
        tx.list_transactions,
        ctx.context.db,
        start_date=start_date,
        end_date=end_date,
        limit=200,
    )

    # Aggregating in Python, not Postgres: one user's transactions is a trivial
    # volume, and an RPC would add a migration and hide the logic. Revisit if slow.
    totals: dict[str, float] = defaultdict(float)
    for row in rows:
        if group_by is GroupBy.CATEGORY:
            key = row["category"]
        elif group_by is GroupBy.TYPE:
            key = row["type"]
        else:
            key = row["date"][:7]  # YYYY-MM-DD -> YYYY-MM
        totals[key] += float(row["amount"])

    return {
        "totals": {k: round(v, 2) for k, v in totals.items()},
        "group_by": group_by.value,
        "transaction_count": len(rows),
        "start_date": start_date,
        "end_date": end_date,
    }


@tool
async def list_budgets(
    ctx: RunContextWrapper[AgentDeps],
    month_year: Optional[str] = None,
) -> dict:
    """List the user's category budget limits.

    Args:
        month_year: Only this month, as YYYY-MM. Omit for all months.
    """
    rows = await asyncio.to_thread(bg.list_budgets, ctx.context.db, month_year=month_year)
    return {"budgets": rows, "count": len(rows)}


@tool
async def get_profile(ctx: RunContextWrapper[AgentDeps]) -> dict:
    """Get the user's profile: their currency, username, and overall monthly budget.

    Call this when you need to know which currency to report amounts in.
    """
    return {"profile": await asyncio.to_thread(pf.get_profile, ctx.context.db)}


@tool
async def add_transaction(
    ctx: RunContextWrapper[AgentDeps],
    amount: float,
    type: TransactionType,
    category: Category,
    date: Optional[str] = None,
    description: Optional[str] = None,
    recurring_interval: RecurringInterval = RecurringInterval.NONE,
) -> dict:
    """Record a new income or expense.

    Args:
        amount: A positive number. The `type` argument carries the sign, so never pass a negative.
        type: Whether this is an expense or income.
        category: Must match the type. Expenses cannot use Salary/Freelance/Investment/Gift.
        date: ISO date (YYYY-MM-DD). Omit to use today.
        description: Optional free-text note.
        recurring_interval: How often this repeats. Defaults to none.
    """
    if amount <= 0:
        raise ValueError("amount must be positive; use `type` to indicate an expense")
    check_category_matches_type(category, type)

    values = {
        "amount": amount,
        "type": type.value,
        "category": category.value,
        "recurring_interval": recurring_interval.value,
    }
    if date:
        values["date"] = date
    if description:
        values["description"] = description

    row = await asyncio.to_thread(tx.insert_transaction, ctx.context.db, values)
    return {"transaction": row}


@tool
async def update_transaction(
    ctx: RunContextWrapper[AgentDeps],
    id: str,
    amount: Optional[float] = None,
    type: Optional[TransactionType] = None,
    category: Optional[Category] = None,
    date: Optional[str] = None,
    description: Optional[str] = None,
    recurring_interval: Optional[RecurringInterval] = None,
) -> dict:
    """Change fields on an existing transaction.

    Supply only the fields that change. Find the id with list_transactions first;
    never guess an id.

    Args:
        id: The transaction's id.
        amount: New positive amount.
        type: New type.
        category: New category. Must be valid for the transaction's type.
        date: New ISO date (YYYY-MM-DD).
        description: New description.
        recurring_interval: New repeat interval.
    """
    changes: dict = {}
    if amount is not None:
        if amount <= 0:
            raise ValueError("amount must be positive")
        changes["amount"] = amount
    if type is not None:
        changes["type"] = type.value
    if category is not None:
        changes["category"] = category.value
    if date is not None:
        changes["date"] = date
    if description is not None:
        changes["description"] = description
    if recurring_interval is not None:
        changes["recurring_interval"] = recurring_interval.value

    if not changes:
        raise ValueError("No fields to update were supplied")

    # A partial update can make category and type disagree, so check against the
    # stored row rather than only the supplied arguments.
    if category is not None:
        existing = await asyncio.to_thread(tx.get_transaction, ctx.context.db, id)
        effective_type = type or TransactionType(existing["type"])
        check_category_matches_type(category, effective_type)

    row = await asyncio.to_thread(tx.update_transaction, ctx.context.db, id, changes)
    return {"transaction": row}


@tool
async def set_budget(
    ctx: RunContextWrapper[AgentDeps],
    category: Category,
    month_year: str,
    limit_amount: float,
) -> dict:
    """Set or replace the spending limit for one expense category in one month.

    Args:
        category: An expense category. Budgets do not apply to income categories.
        month_year: The month, as YYYY-MM.
        limit_amount: The limit, a positive number.
    """
    if limit_amount <= 0:
        raise ValueError("limit_amount must be positive")
    check_category_matches_type(category, TransactionType.EXPENSE)

    row = await asyncio.to_thread(
        bg.upsert_budget,
        ctx.context.db,
        category=category.value,
        month_year=month_year,
        limit_amount=limit_amount,
    )
    return {"budget": row}


@tool
async def propose_delete_transaction(
    ctx: RunContextWrapper[AgentDeps],
    id: str,
) -> dict:
    """Propose deleting a transaction. This does NOT delete it.

    Deleting always requires the user's explicit confirmation. This tool only
    fetches the transaction so they can verify it. The app performs the deletion
    once they agree — you cannot.

    Args:
        id: The transaction's id. Find it with list_transactions first.
    """
    row = await asyncio.to_thread(tx.get_transaction, ctx.context.db, id)
    return {
        "requires_confirmation": True,
        "action": "delete_transaction",
        "transaction": row,
        "note": (
            "Not deleted. Tell the user you need their confirmation, and "
            "summarize the transaction above so they can verify it."
        ),
    }


ALL_TOOLS = [
    list_transactions,
    summarize_spending,
    list_budgets,
    get_profile,
    add_transaction,
    update_transaction,
    set_budget,
    propose_delete_transaction,
]
