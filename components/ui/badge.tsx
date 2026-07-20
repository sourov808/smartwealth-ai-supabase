import { categoryCode, cn } from "@/lib/utils";

/**
 * The square category mark that opens a transaction row. Two letters, mono, no
 * fill — a printer's mark rather than an avatar.
 */
export function CategoryMark({
  category,
  direction,
  className,
}: {
  category: string;
  direction: "pos" | "neg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border font-mono text-[10px] font-medium",
        direction === "neg"
          ? "border-neg/25 text-neg"
          : "border-pos/25 text-pos",
        className
      )}
      aria-hidden
    >
      {categoryCode(category)}
    </span>
  );
}

type Tone = "neutral" | "pos" | "neg" | "warn" | "accent";

const TONES: Record<Tone, string> = {
  neutral: "border-rule text-ink-muted",
  pos: "border-pos/30 text-pos",
  neg: "border-neg/30 text-neg",
  warn: "border-warn/30 text-warn",
  accent: "border-accent/30 text-accent",
};

/** Small outlined label: transaction type, budget status, recurrence. */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
