/**
 * Disconnect Gmail.
 *
 * Two steps, in this order: ask Google to revoke the token, then delete our row.
 * Revoking first means that if the delete somehow fails we are left holding a
 * dead credential rather than a live one.
 *
 * POST rather than GET — this changes state, and a GET could be triggered by an
 * image tag on any page the user visits.
 */

import { NextResponse } from "next/server";

import { decrypt } from "@/lib/integrations/crypto";
import { PROVIDER } from "@/lib/integrations/gmail";
import { createClient } from "@/lib/supabase/server";

// No `export const runtime`: Next 16 rejects it when cacheComponents is enabled,
// and 'nodejs' is the default anyway — which is what node:crypto needs.

const REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Best effort. A token Google has already expired cannot be revoked, and that
  // is not a reason to refuse to disconnect.
  const { data } = await supabase.rpc("integration_access_token", {
    p_provider: PROVIDER,
  });

  if (data) {
    try {
      await fetch(REVOKE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: decrypt(data) }),
        cache: "no-store",
      });
    } catch (error) {
      console.warn("Google token revoke failed, deleting locally anyway:", error);
    }
  }

  const { error } = await supabase.rpc("disconnect_integration", {
    p_provider: PROVIDER,
  });

  if (error) {
    console.error("Gmail disconnect failed:", error);
    return NextResponse.json({ error: "Disconnect failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
