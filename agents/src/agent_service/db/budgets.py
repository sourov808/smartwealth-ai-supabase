"""Budget queries. Plain sync functions: arguments in, rows out."""

from typing import Optional

from supabase import Client

TABLE = "budgets"


def list_budgets(client: Client, *, month_year: Optional[str] = None) -> list[dict]:
    query = client.table(TABLE).select("*")
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
        client.table(TABLE).select("id")
        .eq("category", category).eq("month_year", month_year)
        .execute().data
    )

    if existing:
        return (
            client.table(TABLE)
            .update({"limit_amount": limit_amount})
            .eq("id", existing[0]["id"])
            .execute().data[0]
        )

    return (
        client.table(TABLE)
        .insert({
            "category": category,
            "month_year": month_year,
            "limit_amount": limit_amount,
        })
        .execute().data[0]
    )
