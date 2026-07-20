"""Memory queries, and the caps that bound how much memory reaches a prompt."""

from supabase import Client

from agent_service.core.db import NotFound

# ------------------------------------------------------------------ memories

# Both caps exist to bound the system prompt. See prompts.py.
#
# These were 30 and 200, which was measured at roughly 1,700 prompt tokens at the
# cap — not the ~600 the design assumed. Instructions are re-sent on every turn,
# so that was paid twice per query against a free-tier ceiling of 8,000 tokens
# per minute. 8 and 120 brings the block to roughly 350 tokens.
#
# Raise these only after MAX_MESSAGES in run.py, which is the tighter squeeze.
MAX_INJECTED_MEMORIES = 8
MAX_MEMORY_VALUE_CHARS = 120

# Applied by hand — the project keeps no local migration directory:
#
#   create table agent_memories (
#     id         uuid primary key default gen_random_uuid(),
#     user_id    uuid not null default auth.uid()
#                  references auth.users(id) on delete cascade,
#     key        text not null,
#     value      text not null,
#     updated_at timestamptz not null default now(),
#     unique (user_id, key)
#   );
#   alter table agent_memories enable row level security;
#   create policy "own memories" on agent_memories
#     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


def list_memories(client: Client, *, limit: int = MAX_INJECTED_MEMORIES) -> list[dict]:
    """Most recently updated first — that is the order the cap discards from."""
    return (
        client.table("agent_memories")
        .select("key, value")
        .order("updated_at", desc=True)
        .limit(limit)
        .execute()
        .data
    )


def upsert_memory(client: Client, *, key: str, value: str) -> dict:
    """Store a fact, replacing any existing fact under the same key.

    A true upsert, unlike `upsert_budget` — the unique constraint on
    (user_id, key) exists here, and it is the entire dedup strategy. "Actually I
    get paid on the 30th" reuses the key and overwrites, instead of leaving the
    model to choose between two contradictory rows.
    """
    row = {"key": key, "value": value[:MAX_MEMORY_VALUE_CHARS]}
    return (
        client.table("agent_memories")
        .upsert(row, on_conflict="user_id,key")
        .execute()
        .data[0]
    )


def delete_memory(client: Client, *, key: str) -> dict:
    """Remove a fact. Raises NotFound if there was nothing under that key.

    The one delete in the service. Financial records remain undeletable from this
    process: the no-delete rule protects a ledger, which is painful to
    reconstruct, and a wrong memory is neither.
    """
    deleted = client.table("agent_memories").delete().eq("key", key).execute().data
    if not deleted:
        raise NotFound(f"No memory stored under {key!r}.")
    return deleted[0]
