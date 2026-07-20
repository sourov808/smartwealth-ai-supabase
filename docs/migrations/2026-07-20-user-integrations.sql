-- Third-party OAuth credentials (Gmail first, Notion later).
--
-- Run this in the Supabase SQL editor. The project keeps no local migration
-- directory, so this file is the record.
--
-- Two things about this table are deliberate and load-bearing:
--
-- 1. There is NO select/insert/update policy for authenticated users. RLS with
--    no policy denies everything, which is the point: a Gmail refresh token is
--    standing access to someone's entire mailbox, and it must never be readable
--    through PostgREST — not by the browser, not by anyone holding the anon key,
--    not even by its owner. All access goes through the security-definer
--    functions below, which return status but never the secrets.
--
-- 2. Token columns hold ciphertext, never plaintext. Encryption happens in the
--    application (AES-256-GCM, key in INTEGRATION_ENCRYPTION_KEY) so that a
--    database compromise alone does not yield usable credentials. The database
--    never sees the key.

create table if not exists user_integrations (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null default auth.uid()
                            references auth.users(id) on delete cascade,
  provider                text not null,
  account_email           text,
  refresh_token_encrypted text,
  access_token_encrypted  text,
  access_token_expires_at timestamptz,
  scopes                  text[] not null default '{}',
  status                  text not null default 'connected',
  connected_at            timestamptz not null default now(),
  last_refreshed_at       timestamptz,
  last_error              text,
  unique (user_id, provider)
);

alter table user_integrations enable row level security;

-- Intentionally no policies. See note 1 above. Everything below is
-- security definer and returns only what the caller is allowed to know.


-- Whether the current user has connected a provider. Never returns a token.
create or replace function integration_status(p_provider text)
returns table (
  status        text,
  account_email text,
  scopes        text[],
  connected_at  timestamptz,
  last_error    text
)
language sql
security definer
set search_path = public
as $$
  select status, account_email, scopes, connected_at, last_error
  from user_integrations
  where user_id = auth.uid() and provider = p_provider;
$$;


-- Store credentials for the current user. Called from the OAuth callback.
--
-- refresh_token is COALESCEd rather than overwritten: Google returns one only
-- when it feels like it, and a re-consent that omits it must not wipe the token
-- we already hold.
create or replace function store_integration_credentials(
  p_provider      text,
  p_account_email text,
  p_refresh_token text,
  p_access_token  text,
  p_expires_at    timestamptz,
  p_scopes        text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_integrations (
    user_id, provider, account_email, refresh_token_encrypted,
    access_token_encrypted, access_token_expires_at, scopes,
    status, connected_at, last_error
  )
  values (
    auth.uid(), p_provider, p_account_email, p_refresh_token,
    p_access_token, p_expires_at, coalesce(p_scopes, '{}'),
    'connected', now(), null
  )
  on conflict (user_id, provider) do update set
    account_email           = excluded.account_email,
    refresh_token_encrypted = coalesce(
                                excluded.refresh_token_encrypted,
                                user_integrations.refresh_token_encrypted
                              ),
    access_token_encrypted  = excluded.access_token_encrypted,
    access_token_expires_at = excluded.access_token_expires_at,
    scopes                  = excluded.scopes,
    status                  = 'connected',
    connected_at            = now(),
    last_error              = null;
end;
$$;


-- The current user's access token, still encrypted.
--
-- Needed so the disconnect route can ask Google to revoke the grant rather than
-- only forgetting it locally. What comes back is ciphertext: without
-- INTEGRATION_ENCRYPTION_KEY, which lives in the server environment and never in
-- the database or the browser, it is not a credential. The no-plaintext rule
-- holds.
create or replace function integration_access_token(p_provider text)
returns text
language sql
security definer
set search_path = public
as $$
  select access_token_encrypted
  from user_integrations
  where user_id = auth.uid() and provider = p_provider;
$$;


-- Forget a provider entirely. Deleting beats flagging: a credential we no
-- longer need is a credential that can no longer leak.
create or replace function disconnect_integration(p_provider text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from user_integrations
  where user_id = auth.uid() and provider = p_provider;
$$;


revoke all on function store_integration_credentials(
  text, text, text, text, timestamptz, text[]
) from public;
grant execute on function store_integration_credentials(
  text, text, text, text, timestamptz, text[]
) to authenticated;

revoke all on function integration_status(text) from public;
grant execute on function integration_status(text) to authenticated;

revoke all on function disconnect_integration(text) from public;
grant execute on function disconnect_integration(text) to authenticated;

revoke all on function integration_access_token(text) from public;
grant execute on function integration_access_token(text) to authenticated;
