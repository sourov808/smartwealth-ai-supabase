"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion } from "motion/react";
import { Mail, Lock, User, Wallet, ArrowRight, Loader2 } from "lucide-react";

interface AuthCardProps {
  onSuccess: () => void;
}

export function AuthCard({ onSuccess }: AuthCardProps) {
  const supabase = createClient();
  
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlError = params.get("error");
    if (urlError) {
      setError(decodeURIComponent(urlError));
    }
  }, []);

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setError(null);
    setSuccess(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (oauthError) throw oauthError;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "An OAuth error occurred.";
      setError(errorMessage);
    }
  };

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
        onSuccess();
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
    <motion.div
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
        <h1 className="text-2xl font-bold tracking-tight text-foreground text-center">
          Track
        </h1>
        <p className="text-xs text-stone-400 mt-1">
          Personal cost management app
        </p>
      </div>

      {/* Auth Card Box */}
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

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-stone-400">Or continue with</span>
          </div>
        </div>

        {/* OAuth Providers */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOAuthLogin("google")}
            type="button"
            className="flex items-center justify-center gap-2 py-2 px-3 border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4 text-foreground" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Google</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOAuthLogin("github")}
            type="button"
            className="flex items-center justify-center gap-2 py-2 px-3 border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-stone-50 dark:hover:bg-stone-900 transition-colors cursor-pointer"
          >
            <svg className="h-4 w-4 text-foreground" viewBox="0 0 24 24" fill="currentColor">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.477-10-10-10z"
              />
            </svg>
            <span>GitHub</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
