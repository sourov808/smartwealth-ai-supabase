/**
 * Mints a usable Gmail access token for the agent service.
 *
 * The Python agent service needs to call the Gmail API, which means it needs a
 * live access token. It does not get one by holding credentials: this route is
 * the only thing that decrypts a refresh token, and the only thing that talks to
 * Google's token endpoint. INTEGRATION_ENCRYPTION_KEY exists in exactly one
 * process, and it is this one.
 *
 * ## Two credentials are required, not one
 *
 * The user's JWT proves *whose* mailbox. `X-Agent-Secret` proves the caller is
 * the agent service.
 *
 * The second one is not belt-and-braces. 2026-07-20-user-integrations.sql is
 * explicit that a Gmail token "must never be readable through PostgREST — not by
 * the browser". A route gated on the JWT alone would hand a live Gmail access
 * token to anything running in a logged-in tab, including an XSS payload, and
 * quietly undo that rule. The browser does not have AGENT_SERVICE_SECRET.
 *
 * ## Why it refreshes here rather than returning what is stored
 *
 * Access tokens live an hour. Returning an expired one would push the retry
 * logic into the agent service, which would then need the refresh token, which
 * would need the encryption key. The whole point is that it needs none of them.
 */

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { decrypt, encrypt } from "@/lib/integrations/crypto";
import { PROVIDER, refreshAccessToken } from "@/lib/integrations/gmail";

// No `export const runtime`: Next 16 rejects it when cacheComponents is enabled,
// and 'nodejs' is the default anyway — which is what node:crypto needs.

/** Refresh this long before expiry, so a token cannot die mid-request. */
const EXPIRY_MARGIN_MS = 2 * 60 * 1000;

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token?.trim()) return null;
  return token.trim();
}

export async function GET(request: Request) {
  const secret = process.env.AGENT_SERVICE_SECRET;
  if (!secret) {
    console.error("AGENT_SERVICE_SECRET is not set; refusing to mint tokens.");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }

  // Compared before anything else is read. An unauthorized caller should cost a
  // string comparison and learn nothing.
  if (request.headers.get("x-agent-secret") !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const jwt = bearer(request);
  if (!jwt) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // A client that runs as the user. Every rpc below is scoped by auth.uid()
  // inside the security-definer function, so a forged JWT reaches no rows.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );

  const { data, error } = await supabase.rpc("integration_tokens", {
    p_provider: PROVIDER,
  });

  if (error) {
    console.error("integration_tokens failed:", error.message);
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    // Not an error: the user simply has not connected Gmail.
    return NextResponse.json({ error: "not_connected" }, { status: 404 });
  }

  const expiresAt = row.access_token_expires_at
    ? new Date(row.access_token_expires_at).getTime()
    : 0;

  // The stored token is still good. No Google call, no write.
  if (row.access_token_encrypted && expiresAt - EXPIRY_MARGIN_MS > Date.now()) {
    try {
      return NextResponse.json({
        accessToken: decrypt(row.access_token_encrypted),
      });
    } catch (err) {
      // Ciphertext written under a different key, or corrupted. Fall through to
      // a refresh rather than failing — the refresh token may still decrypt.
      console.warn("Stored Gmail access token did not decrypt:", err);
    }
  }

  if (!row.refresh_token_encrypted) {
    return NextResponse.json({ error: "reconnect_required" }, { status: 409 });
  }

  try {
    const tokens = await refreshAccessToken(decrypt(row.refresh_token_encrypted));

    // Best-effort persistence. A failed write costs one extra refresh next time;
    // it must not deny the caller a token it already holds.
    const { error: writeError } = await supabase.rpc(
      "update_integration_access_token",
      {
        p_provider: PROVIDER,
        p_access_token: encrypt(tokens.accessToken),
        p_expires_at: tokens.expiresAt.toISOString(),
      }
    );
    if (writeError) {
      console.warn("Could not persist refreshed token:", writeError.message);
    }

    return NextResponse.json({ accessToken: tokens.accessToken });
  } catch (err) {
    // Almost always `invalid_grant`: the 7-day Testing-mode refresh expiry, or
    // the user revoked access in their Google account. Neither is retryable, so
    // record it and let the UI ask for a reconnect.
    const message = err instanceof Error ? err.message : "refresh failed";
    console.error("Gmail token refresh failed:", message);

    await supabase.rpc("mark_integration_error", {
      p_provider: PROVIDER,
      p_error: message.slice(0, 500),
    });

    return NextResponse.json({ error: "reconnect_required" }, { status: 409 });
  }
}
