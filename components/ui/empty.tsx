import { cn } from "@/lib/utils";

/**
 * Empty state.
 *
 * No illustration, no icon-in-a-circle. A line of serif text on paper reads as
 * a deliberate blank page rather than a broken one — and it is honest about
 * there being nothing here yet.
 */
export function Empty({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 px-6 py-14 text-center", className)}>
      <p className="display text-xl text-ink-muted">{title}</p>
      {description && (
        <p className="max-w-xs text-sm text-ink-faint">{description}</p>
      )}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}
