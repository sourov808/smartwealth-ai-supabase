"""Long-term memory queries. Plain sync functions: arguments in, rows out.

RLS-scoped by the caller's forwarded JWT, exactly like every other module here.

Requires this table, which is applied by hand — the project keeps no local
migration directory:

    create table agent_memories (
      id         uuid primary key default gen_random_uuid(),
      user_id    uuid not null default auth.uid()
                   references auth.users(id) on delete cascade,
      key        text not null,
      value      text not null,
      updated_at timestamptz not null default now(),
      unique (user_id, key)
    );

    alter table agent_memories enable row level security;

    create policy "own memories" on agent_memories
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
"""

from supabase import Client

from agent_service.db.errors import NotFound

TABLE = "agent_memories"

# Both caps exist to bound the system prompt. See agent/prompts.py.
MAX_INJECTED = 30
MAX_VALUE_CHARS = 200


def list_memories(client: Client, *, limit: int = MAX_INJECTED) -> list[dict]:
    """Most recently updated first — that is the order the cap discards from."""
    return (
        client.table(TABLE)
        .select("key, value")
        .order("updated_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )


def upsert_memory(client: Client, *, key: str, value: str) -> dict:
    """Store a fact, replacing any existing fact under the same key.

    A true Postgres upsert, unlike `budgets.upsert_budget` — the unique
    constraint on (user_id, key) exists here, and it is the entire dedup
    strategy. "Actually I get paid on the 30th" reuses the key and overwrites,
    instead of leaving the model to choose between two contradictory rows.

    `user_id` is omitted on purpose: the column defaults are not set by this
    service. RLS's `with check` clause is what ties the row to the caller.
    """
    row = {"key": key, "value": value[:MAX_VALUE_CHARS]}
    return (
        client.table(TABLE)
        .upsert(row, on_conflict="user_id,key")
        .execute()
        .data[0]
    )


def delete_memory(client: Client, *, key: str) -> dict:
    """Remove a fact. Raises NotFound if there was nothing under that key.

    This is the one delete in the service. Financial records remain
    undeletable from this process; see the exemption in README.md.
    """
    deleted = client.table(TABLE).delete().eq("key", key).execute().data
    if not deleted:
        raise NotFound(f"No memory stored under {key!r}.")
    return deleted[0]
