/**
 * Where Google sends the browser after consent.
 *
 * Exchanges the one-time code for tokens, encrypts them, and hands them to a
 * security-definer function. The tokens never touch the client, and never sit in
 * the database as plaintext.
 *
 * Order matters here: validate `state` BEFORE spending the code. A callback that
 * fails the CSRF check should cost nothing and tell the attacker nothing.
 */

import { NextResponse } from "next/server";

import { encrypt } from "@/lib/integrations/crypto";
import {
  PROVIDER,
  exchangeCode,
  fetchAccountEmail,
} from "@/lib/integrations/gmail";
import { createClient } from "@/lib/supabase/server";

import { STATE_COOKIE } from "../connect/route";

// No `export const runtime`: Next 16 rejects it when cacheComponents is enabled,
// and 'nodejs' is the default anyway — which is what node:crypto needs.

function back(origin: string, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  const response = NextResponse.redirect(`${origin}/dashboard?${query}`);
  // One attempt per cookie, whatever the outcome.
  response.cookies.delete(STATE_COOKIE);
  return response;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  // The user pressed "Cancel", or Google refused. Not an error worth alarming
  // anyone about.
  const denied = searchParams.get("error");
  if (denied) {
    return back(origin, { gmail: "cancelled" });
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const expectedState = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1);

  if (!code || !state || !expectedState || state !== expectedState) {
    // Deliberately vague to the user; specific in the log.
    console.warn("Gmail callback rejected: state mismatch or missing code");
    return back(origin, { error: "Gmail+connection+failed" });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return back(origin, { error: "Sign+in+to+connect+Gmail" });
  }

  try {
    const tokens = await exchangeCode(code);
    const accountEmail = await fetchAccountEmail(tokens.accessToken);

    // `prompt=consent` should mean a refresh token every time. If Google skips
    // it anyway, the stored one is kept — the SQL function COALESCEs rather
    // than overwriting, so passing null here is safe.
    const { error } = await supabase.rpc("store_integration_credentials", {
      p_provider: PROVIDER,
      p_account_email: accountEmail,
      p_refresh_token: tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
      p_access_token: encrypt(tokens.accessToken),
      p_expires_at: tokens.expiresAt.toISOString(),
      p_scopes: tokens.scopes,
    });

    if (error) throw new Error(error.message);

    return back(origin, { gmail: "connected" });
  } catch (error) {
    // Never echo the exception to the user: it can carry token fragments and
    // Google's internal detail.
    console.error("Gmail callback failed:", error);
    return back(origin, { error: "Gmail+connection+failed" });
  }
}
