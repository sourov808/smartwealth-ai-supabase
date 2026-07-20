"""Supabase client construction and the exceptions every query can raise.

Feature-owned queries live with their feature: finance/db.py and memory/db.py.
This module holds only what all of them share.

Nothing here knows about LLMs or HTTP. `user_id` is never passed or filtered
anywhere in this service — the JWT on the client scopes every query, and Postgres
RLS enforces it. If a model hallucinates a user id, the database rejects it.

supabase-py is synchronous. Every caller wraps these in `asyncio.to_thread` or
they block the event loop.
"""

from supabase import Client, ClientOptions, create_client

from agent_service.config import Settings

# ---------------------------------------------------------------- exceptions


class DbError(Exception):
    """Base for anything this module raises."""


class NotFound(DbError):
    """The row does not exist, or RLS hid it. Indistinguishable by design."""


# -------------------------------------------------------------------- client


def create_user_client(settings: Settings, jwt: str) -> Client:
    """A client whose every query runs as the user identified by `jwt`.

    Two non-obvious facts about supabase-py 2.31, both verified against this live
    project. Getting either wrong silently breaks the service or its security:

    1. Supabase's gateway requires an `apikey` header. A request carrying only
       `Authorization: Bearer <jwt>` returns 401 "No API key found in request".

    2. `Client.create()` only injects `apikey` when the caller has NOT supplied
       their own `Authorization` header (supabase/_sync/client.py:108). We always
       supply one, so we must pass `apikey` ourselves. Passing a `headers` dict
       also replaces the library's defaults entirely — nothing else fills it in.

    Hence: both headers, explicitly, every time.
    """
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=ClientOptions(
            headers={
                "apiKey": settings.supabase_anon_key,
                "Authorization": f"Bearer {jwt}",
            },
            # A stateless server handling many users. Never persist a session to
            # disk, and never spawn a refresh thread per request.
            persist_session=False,
            auto_refresh_token=False,
        ),
    )
