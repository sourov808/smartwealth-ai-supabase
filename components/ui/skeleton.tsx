import { cn } from "@/lib/utils";

/**
 * Loading placeholder.
 *
 * The previous skeletons hardcoded `bg-zinc-900`, which rendered as solid black
 * blocks on a light background and was nearly invisible on a dark one. Driving
 * this from a token means it is correct in both themes by construction.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded bg-rule/60", className)}
      aria-hidden
      {...props}
    />
  );
}

/** A skeleton standing in for a line of text, sized to the type scale. */
export function SkeletonText({
  width = "w-full",
  className,
}: {
  width?: string;
  className?: string;
}) {
  return <Skeleton className={cn("h-3.5", width, className)} />;
}

/** Row placeholder matching the transaction list rhythm. */
export function SkeletonRow() {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8" />
        <div className="space-y-1.5">
          <SkeletonText width="w-32" />
          <SkeletonText width="w-20" className="h-2.5" />
        </div>
      </div>
      <SkeletonText width="w-20" />
    </div>
  );
}
