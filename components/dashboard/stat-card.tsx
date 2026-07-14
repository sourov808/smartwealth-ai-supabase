"use client";

import { motion } from "motion/react";
import { LucideIcon } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: number;
  icon: LucideIcon;
  type: "balance" | "income" | "expense";
  currencySymbol?: string;
  subtitle?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  type,
  currencySymbol = "USD",
  subtitle,
}: StatCardProps) {
  const iconColorMap = {
    balance: "text-foreground bg-stone-100 dark:bg-stone-800",
    income: "text-sage bg-sage-light border border-sage/10",
    expense: "text-rust bg-rust-light border border-rust/10",
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="relative overflow-hidden rounded-xl border border-border bg-card p-6 shadow-xs transition-all"
    >
      <div className="flex justify-between items-start">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
            {title}
          </span>
          <h3 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            {formatCurrency(value, currencySymbol)}
          </h3>
          {subtitle && (
            <p className="text-xs text-stone-400 dark:text-stone-400 font-medium">
              {subtitle}
            </p>
          )}
        </div>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${iconColorMap[type]}`}>
          <Icon className="h-4.5 w-4.5 stroke-[1.5]" />
        </div>
      </div>
    </motion.div>
  );
}
