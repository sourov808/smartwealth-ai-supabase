"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Mail, Loader2, CheckCircle2, AlertTriangle, Unplug } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

interface IntegrationStatus {
  status: string;
  account_email: string | null;
  scopes: string[];
  connected_at: string;
  last_error: string | null;
}

/**
 * Connect / disconnect Gmail.
 *
 * Reconnection is presented as routine rather than as a failure, because it is.
 * While the Google Cloud app sits in Testing publishing status, refresh tokens
 * expire after seven days and no amount of correct code changes that — the user
 * has to consent again. Showing a red error every week for expected behaviour
 * would train them to ignore it.
 */
export function GmailConnection() {
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase.rpc("integration_status", {
      p_provider: "gmail",
    });
    // The function returns a set; zero rows means never connected.
    setStatus(Array.isArray(data) && data.length > 0 ? data[0] : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const disconnect = async () => {
    setWorking(true);
    try {
      await fetch("/api/integrations/gmail/disconnect", { method: "POST" });
      await load();
    } finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-neutral-200 p-4 text-sm text-neutral-500 dark:border-neutral-800">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking Gmail connection…
      </div>
    );
  }

  const connected = status?.status === "connected";
  const needsReconnect = status?.status === "expired";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 text-neutral-500" />
          <div>
            <p className="font-medium">Gmail</p>

            {connected && (
              <p className="flex items-center gap-1.5 text-sm text-neutral-500">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                {status?.account_email ?? "Connected"}
              </p>
            )}

            {needsReconnect && (
              <p className="flex items-center gap-1.5 text-sm text-amber-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Access expired — reconnect to keep scanning receipts
              </p>
            )}

            {!connected && !needsReconnect && (
              <p className="text-sm text-neutral-500">
                Find receipts and payments in your inbox automatically
              </p>
            )}
          </div>
        </div>

        {connected ? (
          <button
            onClick={disconnect}
            disabled={working}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
          >
            {working ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Unplug className="h-3.5 w-3.5" />
            )}
            Disconnect
          </button>
        ) : (
          <a
            href="/api/integrations/gmail/connect"
            className="shrink-0 rounded-lg bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
          >
            {needsReconnect ? "Reconnect" : "Connect"}
          </a>
        )}
      </div>

      {connected && (
        <p className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-400 dark:border-neutral-900">
          Read-only access. This app can never send, change, or delete your mail.
        </p>
      )}
    </motion.div>
  );
}
