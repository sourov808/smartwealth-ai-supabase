/**
 * Google OAuth for Gmail: consent URL, code exchange, token refresh.
 *
 * Plain `fetch` against Google's OAuth endpoints rather than `googleapis`. We use
 * three endpoints and one Gmail scope; the SDK is a large dependency for that.
 *
 * ## Read this before debugging "it worked last week"
 *
 * While the Google Cloud app is in **Testing** publishing status, refresh tokens
 * expire after **7 days**. That is not a bug and no code change fixes it — the
 * user must re-consent. Reconnecting is therefore a routine, not an error path,
 * and the UI treats it that way.
 *
 * `gmail.readonly` is a *restricted* scope. Publishing to production requires
 * Google's CASA security assessment; publishing without it leaves the scope
 * blocked at the consent screen. Until that assessment happens, only accounts
 * added as test users in the Cloud Console can connect, capped at 100.
 *
 * ## Why these parameters
 *
 * - `access_type=offline` is what makes Google issue a refresh token at all.
 * - `prompt=consent` forces the refresh token to be re-issued on every consent.
 *   Without it Google returns one only on the very first authorization, and a
 *   user who reconnects gets an access token with no way to renew it.
 * - The scope is read-only, deliberately. This integration never needs to send,
 *   modify, or delete mail, and a token that cannot write is a token that cannot
 *   be turned against the user.
 */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v3/userinfo";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "openid",
  "email",
];

export const PROVIDER = "gmail";

export interface GoogleTokens {
  accessToken: string;
  /** Absent when Google declines to reissue one. Callers must not overwrite a stored token with undefined. */
  refreshToken?: string;
  expiresAt: Date;
  scopes: string[];
}

function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Missing Google OAuth configuration. Set GOOGLE_CLIENT_ID, " +
        "GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI."
    );
  }

  return { clientId, clientSecret, redirectUri };
}

/** Where to send the browser to ask for consent. `state` is the CSRF guard. */
export function consentUrl(state: string): string {
  const { clientId, redirectUri } = config();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GMAIL_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `${AUTH_ENDPOINT}?${params}`;
}

async function postToken(body: Record<string, string>): Promise<GoogleTokens> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
    cache: "no-store",
  });

  const payload = await response.json();

  if (!response.ok) {
    // Google puts the useful part in `error_description`; `error` alone is
    // usually just "invalid_grant", which covers both an expired refresh token
    // and a revoked one.
    throw new Error(
      `Google token request failed (${response.status}): ` +
        `${payload.error ?? "unknown"} — ${payload.error_description ?? "no detail"}`
    );
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt: new Date(Date.now() + payload.expires_in * 1000),
    scopes: payload.scope ? payload.scope.split(" ") : [],
  };
}

/** Exchange the one-time code from the consent redirect for tokens. */
export async function exchangeCode(code: string): Promise<GoogleTokens> {
  const { clientId, clientSecret, redirectUri } = config();

  return postToken({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
}

/**
 * Trade a refresh token for a fresh access token.
 *
 * An `invalid_grant` here almost always means the 7-day Testing-mode expiry has
 * passed, or the user revoked access in their Google account. Both need the user
 * to reconnect; neither is retryable.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<GoogleTokens> {
  const { clientId, clientSecret } = config();

  return postToken({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
}

/** Which Google account consented. Shown in the UI so a wrong-account connect is obvious. */
export async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) return null;

  const payload = await response.json();
  return payload.email ?? null;
}
