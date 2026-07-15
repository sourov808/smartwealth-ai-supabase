"""Profile queries. Plain sync functions: arguments in, rows out."""

from supabase import Client

from agent_service.db.errors import NotFound

TABLE = "profiles"


def get_profile(client: Client) -> dict:
    """The current user's profile.

    No id argument: RLS narrows this table to exactly one row — the caller's.
    """
    rows = client.table(TABLE).select("*").limit(1).execute().data
    if not rows:
        raise NotFound("No profile row for the current user")
    return rows[0]
