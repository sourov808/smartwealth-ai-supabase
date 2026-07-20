import { Loader2 } from "lucide-react";

/**
 * Suspense fallback for a page's data boundary.
 *
 * The four dashboard pages each had this block written out by hand, in a
 * bordered card that no longer exists in this design. One component now, so a
 * change lands everywhere.
 */
export function Pending({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 py-24"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin text-ink-faint" strokeWidth={1.5} />
      <p className="text-sm text-ink-faint">{message}</p>
    </div>
  );
}
