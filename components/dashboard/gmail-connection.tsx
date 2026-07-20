"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Mail, Loader2, Unplug } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { fadeUp } from "@/lib/motion";

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
      <div className="flex items-center gap-2 border-t border-rule pt-4 text-sm text-ink-faint">
        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
        Checking Gmail connection…
      </div>
    );
  }

  const connected = status?.status === "connected";
  const needsReconnect = status?.status === "expired";

  return (
    <motion.div
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-4 text-sm"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <Mail className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.5} />
        <span className="text-ink">Gmail</span>

        {connected && (
          <>
            <Badge tone="pos">Connected</Badge>
            <span className="truncate text-ink-faint">
              {status?.account_email ?? "Connected"}
            </span>
          </>
        )}

        {needsReconnect && (
          <>
            <Badge tone="warn">Expired</Badge>
            <span className="text-warn">
              Reconnect to keep scanning receipts
            </span>
          </>
        )}

        {!connected && !needsReconnect && (
          <span className="text-ink-faint">
            Find receipts and payments in your inbox automatically
          </span>
        )}
      </div>

      {connected ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={disconnect}
          disabled={working}
        >
          {working ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
          ) : (
            <Unplug className="h-3.5 w-3.5" strokeWidth={1.5} />
          )}
          Disconnect
        </Button>
      ) : (
        <ButtonLink variant="ghost" size="sm" href="/api/integrations/gmail/connect">
          {needsReconnect ? "Reconnect" : "Connect"}
        </ButtonLink>
      )}
    </motion.div>
  );
}
