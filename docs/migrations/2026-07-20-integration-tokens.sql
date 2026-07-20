-- Token access for the agent service's Gmail search.
--
-- Run this in the Supabase SQL editor, after 2026-07-20-user-integrations.sql.
--
-- ## Why this exists
--
-- The agent service needs a *working* Gmail access token. The existing
-- `integration_access_token()` returns only the access token, which lives one
-- hour, and nothing exposed the refresh token or the expiry — so an hour after
-- connecting, a scan had no way to recover.
--
-- The fix is deliberately NOT "let Python refresh tokens". Python never gets the
-- encryption key and never talks to Google's token endpoint. Next.js already
-- owns that logic in lib/integrations/gmail.ts; these two functions let it keep
-- owning it, and the agent service asks Next.js for a token it can use.
--
-- ## Why returning refresh_token_encrypted is safe
--
-- Same argument as `integration_access_token`, and it has to hold here too
-- because a refresh token is the more valuable secret. What comes back is
-- ciphertext. INTEGRATION_ENCRYPTION_KEY lives in the Next.js server
-- environment — never in the database, never in the browser, never in the agent
-- service. Without it these bytes are not a credential.
--
-- The table still has no RLS policies, so this is reachable only through
-- security-definer functions scoped to auth.uid(). No caller can ask for
-- someone else's row.


-- Everything the token route needs to decide "reuse or refresh", in one call.
--
-- Returning the expiry matters as much as the tokens: without it the route
-- would have to refresh on every request, spending a Google call and a write to
-- answer a question the database could have answered.
create or replace function integration_tokens(p_provider text)
returns table (
  access_token_encrypted  text,
  refresh_token_encrypted text,
  access_token_expires_at timestamptz,
  status                  text
)
language sql
security definer
set search_path = public
as $$
  select access_token_encrypted, refresh_token_encrypted,
         access_token_expires_at, status
  from user_integrations
  where user_id = auth.uid() and provider = p_provider;
$$;


-- Write back a freshly refreshed access token, and nothing else.
--
-- `store_integration_credentials` would also work, but it overwrites
-- account_email and scopes from its arguments — so a refresh that passed null
-- for those would quietly erase them. A refresh knows about exactly two columns
-- and should be able to touch exactly two columns.
create or replace function update_integration_access_token(
  p_provider     text,
  p_access_token text,
  p_expires_at   timestamptz
)
returns void
language sql
security definer
set search_path = public
as $$
  update user_integrations
  set access_token_encrypted  = p_access_token,
      access_token_expires_at = p_expires_at,
      last_refreshed_at       = now(),
      status                  = 'connected',
      last_error              = null
  where user_id = auth.uid() and provider = p_provider;
$$;


-- Record a refresh failure so the UI can tell the user to reconnect.
--
-- Separate from the success path because the failure that matters most —
-- invalid_grant after the 7-day Testing-mode refresh token expiry — is not
-- retryable and must surface as a reconnect prompt, not a silent empty result.
create or replace function mark_integration_error(
  p_provider text,
  p_error    text
)
returns void
language sql
security definer
set search_path = public
as $$
  update user_integrations
  set status = 'error', last_error = p_error
  where user_id = auth.uid() and provider = p_provider;
$$;


revoke all on function integration_tokens(text) from public;
grant execute on function integration_tokens(text) to authenticated;

revoke all on function update_integration_access_token(text, text, timestamptz)
  from public;
grant execute on function update_integration_access_token(text, text, timestamptz)
  to authenticated;

revoke all on function mark_integration_error(text, text) from public;
grant execute on function mark_integration_error(text, text) to authenticated;
