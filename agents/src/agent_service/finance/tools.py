"""The finance agent's tools.

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
from collections import defaultdict
from typing import Optional

from agents import RunContextWrapper, function_tool

from agent_service.core.context import RequestContext


def _tool_error(ctx: RunContextWrapper, error: Exception) -> str:
    return f"The tool failed: {type(error).__name__}: {error}"


tool = function_tool(strict_mode=False, failure_error_function=_tool_error)

Ctx = RunContextWrapper[RequestContext]

from agent_service.finance import db
from agent_service.finance.models import (
    Category,
    GroupBy,
    RecurringInterval,
    TransactionType,
    budget_view,
    check_category_matches_type,
    transaction_view,
)


# ------------------------------------------------------------------ reporting


@tool
async def list_transactions(
    ctx: Ctx,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[Category] = None,
    type: Optional[TransactionType] = None,
    summarize: bool = False,
    group_by: GroupBy = GroupBy.CATEGORY,
    limit: int = 50,
) -> dict:
    """Read the user's transactions, either as rows or as totals.

    Set summarize=True for "how much" questions — it returns totals instead of
    rows, which is both what the user asked for and far smaller. Leave it False
    for "which" questions, or to find a transaction's id.

    Args:
        start_date: Only transactions on or after this ISO date (YYYY-MM-DD). Omit for no lower bound.
        end_date: Only transactions on or before this ISO date (YYYY-MM-DD). Omit for no upper bound.
        category: Only this one category. Omit unless the user named a specific category.
        type: Only expenses, or only income. Omit for both.
        summarize: True to return grouped totals, False to return rows.
        group_by: How to break totals down. Only used when summarize is True.
        limit: Maximum rows to consider, 1-200.
    """
    # This was two tools until the router refactor. They differed mainly in
    # whether the dates were required, and a second schema on every call is a
    # real cost against an 8,000 token/min ceiling. `group_by` takes a default
    # rather than Optional[GroupBy] on purpose: an optional enum becomes
    # `anyOf: [GroupBy, null]`, which Groq rejects outright.
    rows = await asyncio.to_thread(
        db.list_transactions,
        ctx.context.db,
        start_date=start_date,
        end_date=end_date,
        category=category.value if category else None,
        type=type.value if type else None,
        limit=200 if summarize else max(1, min(limit, 200)),
    )

    if not summarize:
        return {"transactions": [transaction_view(r) for r in rows], "count": len(rows)}

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


# ----------------------------------------------------------------- bookkeeping


@tool
async def add_transaction(
    ctx: Ctx,
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

    row = await asyncio.to_thread(db.insert_transaction, ctx.context.db, values)
    return {"transaction": transaction_view(row)}


@tool
async def update_transaction(
    ctx: Ctx,
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
        existing = await asyncio.to_thread(db.get_transaction, ctx.context.db, id)
        effective_type = type or TransactionType(existing["type"])
        check_category_matches_type(category, effective_type)

    row = await asyncio.to_thread(db.update_transaction, ctx.context.db, id, changes)
    return {"transaction": transaction_view(row)}


@tool
async def propose_delete_transaction(ctx: Ctx, id: str) -> dict:
    """Propose deleting a transaction. This does NOT delete it.

    Deleting always requires the user's explicit confirmation. This tool only
    fetches the transaction so they can verify it. The app performs the deletion
    once they agree — you cannot.

    Args:
        id: The transaction's id. Find it with list_transactions first.
    """
    row = await asyncio.to_thread(db.get_transaction, ctx.context.db, id)

    # Stashed by code, not by the model. run.py reads this to build the
    # confirmation card, so the amount the user sees is the stored row rather
    # than a number the model retyped into a tool argument.
    #
    # The FULL row goes here; only the trimmed view goes back to the model. The
    # card is rendered from this copy, so it must not lose fields to a prompt
    # optimization.
    ctx.context.pending_delete = row

    return {
        "requires_confirmation": True,
        "transaction": transaction_view(row),
        "note": (
            "Not deleted. Tell the user you need their confirmation, and "
            "summarize the transaction above so they can verify it."
        ),
    }


# --------------------------------------------------------------------- budgets


@tool
async def list_budgets(ctx: Ctx, month_year: Optional[str] = None) -> dict:
    """List the user's category budget limits.

    Args:
        month_year: Only this month, as YYYY-MM. Omit for all months.
    """
    rows = await asyncio.to_thread(db.list_budgets, ctx.context.db, month_year=month_year)
    return {"budgets": [budget_view(r) for r in rows], "count": len(rows)}


@tool
async def set_budget(
    ctx: Ctx,
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
        db.upsert_budget,
        ctx.context.db,
        category=category.value,
        month_year=month_year,
        limit_amount=limit_amount,
    )
    return {"budget": budget_view(row)}
