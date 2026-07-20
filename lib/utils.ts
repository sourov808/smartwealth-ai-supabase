import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(amount);
}

/**
 * Short form for chart axes and dense cells, where the full currency string
 * would collide with its neighbours: 12480 -> "$12.5K".
 */
export function formatCompact(amount: number, currency: string = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

export type Delta = {
  pct: number;
  direction: "up" | "down" | "flat";
  /** Ready to render, e.g. "4.2% · $498 more than last month". */
  label: string;
};

/**
 * Period-over-period change.
 *
 * Returns null when there is no meaningful comparison to draw — no previous
 * period, or a previous value of zero, where percentage change is undefined
 * rather than infinite. Callers render nothing in that case; inventing "+100%"
 * for a first-ever month would be a number the user cannot check.
 */
export function formatDelta(
  current: number,
  previous: number | null | undefined,
  periodLabel: string = "last month"
): Delta | null {
  if (previous === null || previous === undefined || previous === 0) return null;

  const diff = current - previous;
  const pct = (diff / Math.abs(previous)) * 100;

  if (Math.abs(pct) < 0.05) {
    return { pct: 0, direction: "flat", label: `No change from ${periodLabel}` };
  }

  const direction = diff > 0 ? "up" : "down";
  const word = diff > 0 ? "more than" : "less than";

  return {
    pct: Math.abs(pct),
    direction,
    label: `${Math.abs(pct).toFixed(1)}% · ${formatCurrency(
      Math.abs(diff)
    )} ${word} ${periodLabel}`,
  };
}

/** Two-letter category code used by the badge chips. */
export function categoryCode(category: string): string {
  return category.slice(0, 2).toUpperCase();
}
