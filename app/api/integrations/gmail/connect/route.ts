/**
 * Starts the Gmail consent flow.
 *
 * The `state` parameter is a CSRF guard, not decoration: without it an attacker
 * can hand a victim a crafted callback URL and graft their own Google account
 * onto the victim's session. We mint a random value, put it in an httpOnly
 * cookie, and require the two to match on the way back.
 */

import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

import { consentUrl } from "@/lib/integrations/gmail";
import { createClient } from "@/lib/supabase/server";

// No `export const runtime`: Next 16 rejects it when cacheComponents is enabled,
// and 'nodejs' is the default anyway — which is what node:crypto needs.

export const STATE_COOKIE = "gmail_oauth_state";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/?error=Sign+in+to+connect+Gmail`);
  }

  const state = randomBytes(32).toString("base64url");

  let target: string;
  try {
    target = consentUrl(state);
  } catch (error) {
    // Missing GOOGLE_* env vars. Surface it rather than bouncing the user to
    // Google with a malformed URL and letting them read Google's error page.
    console.error("Gmail connect misconfigured:", error);
    return NextResponse.redirect(
      `${origin}/dashboard?error=Gmail+is+not+configured+on+this+server`
    );
  }

  const response = NextResponse.redirect(target);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // must survive Google's cross-site redirect back
    path: "/api/integrations/gmail",
    maxAge: 600, // consent that takes over 10 minutes is a stale attempt
  });

  return response;
}
