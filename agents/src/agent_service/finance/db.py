"""Finance queries: transactions, budgets, and the user's profile.

There is deliberately no `delete_transaction`. Deletes are proposed by the agent
and executed by the frontend after the user confirms; the capability does not
exist in this process.

`user_id` is never passed or filtered here — RLS scopes every query. Inserts omit
it entirely because the column defaults to auth.uid().
"""

from typing import Optional

from supabase import Client

from agent_service.core.db import NotFound

# -------------------------------------------------------------- transactions


def list_transactions(
    client: Client,
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    type: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    query = client.table("transactions").select("*")

    if start_date:
        query = query.gte("date", start_date)
    if end_date:
        query = query.lte("date", end_date)
    if category:
        query = query.eq("category", category)
    if type:
        query = query.eq("type", type)

    return query.order("date", desc=True).limit(limit).execute().data


def get_transaction(client: Client, transaction_id: str) -> dict:
    rows = client.table("transactions").select("*").eq("id", transaction_id).execute().data
    if not rows:
        # Could be a bad id, or RLS hiding someone else's row. We cannot tell
        # them apart, and should not try — leaking the difference would confirm
        # the row exists.
        raise NotFound(f"No transaction with id {transaction_id}")
    return rows[0]


def insert_transaction(client: Client, values: dict) -> dict:
    # user_id is omitted on purpose: the column defaults to auth.uid().
    return client.table("transactions").insert(values).execute().data[0]


def update_transaction(client: Client, transaction_id: str, changes: dict) -> dict:
    rows = (
        client.table("transactions").update(changes).eq("id", transaction_id).execute().data
    )
    if not rows:
        raise NotFound(f"No transaction with id {transaction_id}")
    return rows[0]


# ------------------------------------------------------------------ budgets


def list_budgets(client: Client, *, month_year: Optional[str] = None) -> list[dict]:
    query = client.table("budgets").select("*")
    if month_year:
        query = query.eq("month_year", month_year)
    return query.order("category").execute().data


def upsert_budget(
    client: Client, *, category: str, month_year: str, limit_amount: float
) -> dict:
    """Set a category's limit for a month, replacing any existing limit.

    Read-then-write rather than a true upsert: a Postgres ON CONFLICT needs a
    unique constraint on (user_id, category, month_year), which this schema does
    not have. The race window is a user contradicting themselves in two
    simultaneous chats — not a real risk here. Revisit if a constraint is added.
    """
    existing = (
        client.table("budgets").select("id")
        .eq("category", category).eq("month_year", month_year)
        .execute().data
    )

    if existing:
        return (
            client.table("budgets")
            .update({"limit_amount": limit_amount})
            .eq("id", existing[0]["id"])
            .execute().data[0]
        )

    return (
        client.table("budgets")
        .insert({
            "category": category,
            "month_year": month_year,
            "limit_amount": limit_amount,
        })
        .execute().data[0]
    )


# ------------------------------------------------------------------ profiles


def get_profile(client: Client) -> dict:
    """The current user's profile.

    No id argument: RLS narrows this table to exactly one row — the caller's.
    """
    rows = client.table("profiles").select("*").limit(1).execute().data
    if not rows:
        raise NotFound("No profile row for the current user")
    return rows[0]

