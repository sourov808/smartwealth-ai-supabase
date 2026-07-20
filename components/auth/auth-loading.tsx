"use client";

import { motion } from "motion/react";
import { Loader2 } from "lucide-react";

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
      className="flex flex-col items-center justify-center gap-4 text-center"
    >
      <h2 className="display text-2xl text-ink">Welcome to your records</h2>

      <div className="flex items-center gap-2 text-ink-faint">
        <Loader2
          className={isSpinning ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5 animate-pulse"}
          strokeWidth={1.5}
        />
        <p className="text-xs">{message}</p>
      </div>
    </motion.div>
  );
}
