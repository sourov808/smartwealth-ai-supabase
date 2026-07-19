"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RealtimeListener() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    console.log("Setting up Realtime subscription...");
    // Subscribe to public database changes on key tables
    const channel = supabase
      .channel("db-realtime-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        (payload) => {
          console.log("Realtime change detected in transactions:", payload);
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "budgets" },
        (payload) => {
          console.log("Realtime change detected in budgets:", payload);
          router.refresh();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        (payload) => {
          console.log("Realtime change detected in profiles:", payload);
          router.refresh();
        }
      )
      .subscribe((status, err) => {
        console.log(`Realtime subscription status: ${status}`, err || "");
      });

    return () => {
      console.log("Cleaning up Realtime subscription...");
      supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  return null;
}
