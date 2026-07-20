import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";

/**
 * A monetary amount: mono, tabular, and colored by direction.
 *
 * Tabular figures matter more than they look like they do — without them the
 * decimal points in a transaction column wander, which is the single most
 * common reason a financial table reads as amateur.
 */
export function Money({
  amount,
  signed = false,
  direction,
  className,
}: {
  amount: number;
  /** Prefix an explicit + or −. Use in ledgers, not for balances. */
  signed?: boolean;
  /** Overrides the color. Omit to color by the sign of `amount`. */
  direction?: "pos" | "neg" | "neutral";
  className?: string;
}) {
  const resolved =
    direction ?? (amount < 0 ? "neg" : amount > 0 ? "pos" : "neutral");

  const tone =
    resolved === "pos"
      ? "text-pos"
      : resolved === "neg"
        ? "text-neg"
        : "text-ink";

  // The minus is U+2212, not a hyphen. At mono widths a hyphen sits too high
  // and too short next to figures.
  const prefix = signed ? (resolved === "neg" ? "− " : "+ ") : "";

  return (
    <span className={cn("tabular font-mono", tone, className)}>
      {prefix}
      {formatCurrency(Math.abs(amount))}
    </span>
  );
}
