"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, User, Wallet, ArrowRight, Loader2 } from "lucide-react";

export default function RootPage() {
  const router = useRouter();
  const supabase = createClient();
  const [status, setStatus] = useState<"checking" | "redirecting" | "auth">("checking");
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        
        setStatus("redirecting");
        router.push("/dashboard");
        router.refresh();
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username: username || email.split("@")[0],
            },
          },
        });
        if (signUpError) throw signUpError;
        
        setSuccess("Registration successful! Check your email or sign in.");
        setIsLogin(true);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An authentication error occurred.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background text-foreground font-sans px-4 relative">
      <AnimatePresence mode="wait">
        {status === "checking" && (
          <motion.div
            key="checking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center text-center space-y-3"
          >
            <div className="h-10 w-10 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center border border-border">
              <Wallet className="h-5 w-5 text-foreground stroke-[1.5] animate-pulse" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-tight text-foreground">Welcome to your records</h2>
              <p className="text-xs text-stone-400">Verifying session...</p>
            </div>
          </motion.div>
        )}

        {status === "redirecting" && (
          <motion.div
            key="redirecting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center text-center space-y-3"
          >
            <div className="h-10 w-10 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center border border-border">
              <Loader2 className="h-5 w-5 text-foreground stroke-[1.5] animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-tight text-foreground">Welcome to your records</h2>
              <p className="text-xs text-stone-400">Redirecting to dashboard...</p>
            </div>
          </motion.div>
        )}

        {status === "auth" && (
          <motion.div
            key="auth"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="w-full max-w-sm"
          >
            {/* Header / Brand */}
            <div className="flex flex-col items-center mb-6 text-center">
              <div className="h-10 w-10 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center border border-border mb-3">
                <Wallet className="h-5 w-5 text-foreground stroke-[1.5]" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Track
              </h1>
              <p className="text-xs text-stone-400 mt-1">
                Personal cost management app
              </p>
            </div>

            {/* Auth Card */}
            <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
              {/* Tab Selector */}
              <div className="flex border-b border-border mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(true);
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`flex-1 pb-2.5 text-sm font-medium transition-colors relative cursor-pointer ${
                    isLogin ? "text-foreground font-semibold" : "text-stone-400 hover:text-foreground"
                  }`}
                >
                  Sign In
                  {isLogin && (
                    <motion.div
                      layoutId="auth-tab-underline"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground"
                    />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(false);
                    setError(null);
                    setSuccess(null);
                  }}
                  className={`flex-1 pb-2.5 text-sm font-medium transition-colors relative cursor-pointer ${
                    !isLogin ? "text-foreground font-semibold" : "text-stone-400 hover:text-foreground"
                  }`}
                >
                  Sign Up
                  {!isLogin && (
                    <motion.div
                      layoutId="auth-tab-underline"
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground"
                    />
                  )}
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {/* Banners */}
                {error && (
                  <div className="p-3 text-xs bg-rust-light border border-rust/20 text-rust rounded-lg">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="p-3 text-xs bg-sage-light border border-sage/20 text-sage rounded-lg">
                    {success}
                  </div>
                )}

                {/* Username Input */}
                {!isLogin && (
                  <div>
                    <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wider">
                      Username
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 stroke-[1.5]" />
                      <input
                        type="text"
                        placeholder="e.g. username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-transparent border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2 pl-9 pr-3 text-sm placeholder:text-stone-400 outline-none transition-all text-foreground"
                        required={!isLogin}
                      />
                    </div>
                  </div>
                )}

                {/* Email Input */}
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wider">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 stroke-[1.5]" />
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-transparent border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2 pl-9 pr-3 text-sm placeholder:text-stone-400 outline-none transition-all text-foreground"
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <label className="block text-xs font-semibold text-stone-500 mb-1.5 uppercase tracking-wider">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 stroke-[1.5]" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-transparent border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2 pl-9 pr-3 text-sm placeholder:text-stone-400 outline-none transition-all text-foreground"
                      required
                    />
                  </div>
                </div>

                {/* Action Submit */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="w-full bg-foreground text-background font-semibold py-2 rounded-lg hover:opacity-90 flex items-center justify-center gap-2 text-sm shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-background" />
                  ) : (
                    <>
                      <span>{isLogin ? "Sign In" : "Register"}</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </motion.button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
