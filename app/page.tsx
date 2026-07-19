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
      // Small timeout to give it a premium initial feel rather than abrupt jump
      const checkDelay = new Promise((resolve) => setTimeout(resolve, 800));
      const getSessionPromise = supabase.auth.getSession();
      
      const [, sessionResult] = await Promise.all([checkDelay, getSessionPromise]);
      const session = sessionResult.data.session;

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
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground font-sans px-4 relative">
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
