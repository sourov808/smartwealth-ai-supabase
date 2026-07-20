import { cn, formatCurrency } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * Budget progress.
 *
 * The thresholds live here and nowhere else. They were previously written out
 * twice — once in the dashboard summary, once on the budgets page — which is
 * two copies of a business rule that must agree. If they drift, the same budget
 * reads "On track" on one page and "Warning" on another.
 */

export const WARN_AT = 0.8;

export type BudgetStatus = "ok" | "warn" | "over";

export function budgetStatus(spent: number, limit: number): BudgetStatus {
  if (limit <= 0) return "ok";
  if (spent > limit) return "over";
  if (spent / limit >= WARN_AT) return "warn";
  return "ok";
}

const STATUS_LABEL: Record<BudgetStatus, string> = {
  ok: "On track",
  warn: "Near limit",
  over: "Over limit",
};

const STATUS_TONE = {
  ok: "pos",
  warn: "warn",
  over: "neg",
} as const;

const BAR = {
  ok: "bg-pos",
  warn: "bg-warn",
  over: "bg-neg",
} as const;

export function Meter({
  label,
  spent,
  limit,
  showStatus = false,
  className,
}: {
  label: string;
  spent: number;
  limit: number;
  /** Adds a status chip and percentage line beneath. Used on the budgets page. */
  showStatus?: boolean;
  className?: string;
}) {
  const status = budgetStatus(spent, limit);
  const ratio = limit > 0 ? spent / limit : 0;
  const width = Math.min(Math.round(ratio * 100), 100);
  const pct = Math.round(ratio * 100);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-ink">{label}</span>
        <span className="tabular font-mono text-ink-muted">
          {formatCurrency(spent)}
          <span className="text-ink-faint"> / {formatCurrency(limit)}</span>
        </span>
      </div>

      {/* A 2px rule that fills, not a rounded pill. Matches the hairlines around it. */}
      <div
        className="h-[3px] w-full overflow-hidden bg-rule"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} budget used`}
      >
        <div
          style={{ width: `${width}%` }}
          className={cn("h-full transition-[width] duration-500 ease-out", BAR[status])}
        />
      </div>

      {showStatus && (
        <div className="flex items-center justify-between gap-2">
          <span className="tabular font-mono text-[10px] text-ink-faint">
            {pct}% used
          </span>
          <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
        </div>
      )}
    </div>
  );
}
