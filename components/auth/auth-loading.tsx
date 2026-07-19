"use client";

import { motion } from "motion/react";
import { Wallet, Loader2 } from "lucide-react";

interface AuthLoadingProps {
  message: string;
  isSpinning?: boolean;
}

export function AuthLoading({ message, isSpinning = false }: AuthLoadingProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center text-center space-y-3"
    >
      <div className="h-10 w-10 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center border border-border">
        {isSpinning ? (
          <Loader2 className="h-5 w-5 text-foreground stroke-[1.5] animate-spin" />
        ) : (
          <Wallet className="h-5 w-5 text-foreground stroke-[1.5] animate-pulse" />
        )}
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-bold tracking-tight text-foreground">Welcome to your records</h2>
        <p className="text-xs text-stone-400">{message}</p>
      </div>
    </motion.div>
  );
}
