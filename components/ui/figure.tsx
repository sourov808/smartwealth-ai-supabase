"use client";

import { motion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";

import { fadeUp } from "@/lib/motion";
import { cn, formatCurrency, type Delta } from "@/lib/utils";

type Size = "display" | "figure";

/**
 * An editorial number: eyebrow label above, serif value, optional delta line.
 *
 * Replaces both `stat-card` and the four bespoke KPI cards in analytics. There
 * is no box — the number carries the weight, which is the whole point of the
 * direction. `display` is reserved for one number per page.
 */
export function Figure({
  label,
  value,
  delta,
  hint,
  size = "figure",
  /** Colors the value itself. Balances stay ink; income/expense take a side. */
  tone = "ink",
  className,
}: {
  label: string;
  value: number | string;
  delta?: Delta | null;
  hint?: string;
  size?: Size;
  tone?: "ink" | "pos" | "neg";
  className?: string;
}) {
  const rendered = typeof value === "number" ? formatCurrency(value) : value;

  return (
    <motion.div variants={fadeUp} className={cn("space-y-1.5", className)}>
      <p className="eyebrow">{label}</p>

      <p
        className={cn(
          "display tabular",
          size === "display"
            ? "text-[clamp(2.75rem,5vw,3.5rem)]"
            : "text-3xl",
          tone === "pos" && "text-pos",
          tone === "neg" && "text-neg",
          tone === "ink" && "text-ink"
        )}
      >
        {rendered}
      </p>

      {delta && <DeltaLine delta={delta} />}
      {!delta && hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </motion.div>
  );
}

function DeltaLine({ delta }: { delta: Delta }) {
  const Icon =
    delta.direction === "up"
      ? ArrowUpRight
      : delta.direction === "down"
        ? ArrowDownRight
        : Minus;

  // Deliberately not colored by direction. Spending more is not universally
  // bad and earning more is not universally good; the caller's context decides,
  // and painting every rise green would misinform.
  return (
    <p className="flex items-center gap-1 text-xs text-ink-muted">
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
      <span>{delta.label}</span>
    </p>
  );
}
