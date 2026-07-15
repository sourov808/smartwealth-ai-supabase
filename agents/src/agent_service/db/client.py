"""Builds a Supabase client scoped to one user's JWT.

Two non-obvious facts about supabase-py 2.31, both verified against this live
project. Getting either wrong silently breaks the service or its security:

1. Supabase's gateway requires an `apikey` header. A request carrying only
   `Authorization: Bearer <jwt>` returns 401 "No API key found in request".

2. `Client.create()` only injects the `apikey` header when the caller has NOT
   supplied their own `Authorization` header (supabase/_sync/client.py:108).
   We always supply one, so we must pass `apikey` ourselves. Passing a `headers`
   dict also replaces the library's defaults entirely — nothing else fills it in.

Hence: both headers, explicitly, every time.
"""

from supabase import Client, ClientOptions, create_client

from agent_service.config import Settings


def create_user_client(settings: Settings, jwt: str) -> Client:
    """A client whose every query runs as the user identified by `jwt`.

    RLS — not this code — is what stops one user reading another's rows.
    """
    return create_client(
        settings.supabase_url,
        settings.supabase_anon_key,
        options=ClientOptions(
            headers={
                "apiKey": settings.supabase_anon_key,
                "Authorization": f"Bearer {jwt}",
            },
            # This is a stateless server handling many users. Never persist a
            # session to disk, and never spawn a refresh thread per request.
            persist_session=False,
            auto_refresh_token=False,
        ),
    )
