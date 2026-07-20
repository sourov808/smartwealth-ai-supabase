"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AnimatePresence } from "motion/react";
import { AuthLoading } from "@/components/auth/auth-loading";
import { AuthCard } from "@/components/auth/auth-card";

export default function RootPage() {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<"checking" | "redirecting" | "auth">("checking");

  useEffect(() => {
    async function checkAuth() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (session) {
        setStatus("redirecting");
        router.push("/dashboard");
        router.refresh();
      } else {
        setStatus("auth");
      }
    }
    checkAuth();
  }, [router, supabase]);

  const handleAuthSuccess = () => {
    setStatus("redirecting");
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-paper px-6 text-ink">
      <AnimatePresence mode="wait">
        {status === "checking" && (
          <AuthLoading key="checking" message="Verifying session..." />
        )}

        {status === "redirecting" && (
          <AuthLoading key="redirecting" message="Redirecting to dashboard..." isSpinning />
        )}

        {status === "auth" && (
          <AuthCard key="auth" onSuccess={handleAuthSuccess} />
        )}
      </AnimatePresence>
    </div>
  );
}
