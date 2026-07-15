"""Transaction queries. Plain sync functions: arguments in, rows out.

This module knows nothing about LLMs or HTTP. `user_id` is never passed or
filtered here — the JWT on the client scopes every query, and RLS enforces it.

There is deliberately no delete function. Deletes are proposed by the agent and
executed by the frontend after the user confirms.
"""

from typing import Optional

from supabase import Client

from agent_service.db.errors import NotFound

TABLE = "transactions"


def list_transactions(
    client: Client,
    *,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    category: Optional[str] = None,
    type: Optional[str] = None,
    limit: int = 50,
) -> list[dict]:
    query = client.table(TABLE).select("*")

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
    rows = client.table(TABLE).select("*").eq("id", transaction_id).execute().data
    if not rows:
        # Could be a bad id, or RLS hiding someone else's row. We cannot tell
        # them apart, and should not try — leaking the difference would confirm
        # the row exists.
        raise NotFound(f"No transaction with id {transaction_id}")
    return rows[0]


def insert_transaction(client: Client, values: dict) -> dict:
    # user_id is omitted on purpose: the column defaults to auth.uid().
    return client.table(TABLE).insert(values).execute().data[0]


def update_transaction(client: Client, transaction_id: str, changes: dict) -> dict:
    rows = client.table(TABLE).update(changes).eq("id", transaction_id).execute().data
    if not rows:
        raise NotFound(f"No transaction with id {transaction_id}")
    return rows[0]
