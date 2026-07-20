import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <div className="space-y-section">
      {/* Masthead */}
      <div className="flex flex-col gap-4 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <SkeletonText width="w-80" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>

      {/* Filter row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="space-y-2 sm:flex-1">
          <SkeletonText width="w-16" className="h-2.5" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="space-y-2 sm:w-44 sm:shrink-0">
          <SkeletonText width="w-12" className="h-2.5" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="space-y-2 sm:w-44 sm:shrink-0">
          <SkeletonText width="w-20" className="h-2.5" />
          <Skeleton className="h-8 w-full" />
        </div>
      </div>

      {/* Ledger */}
      <div>
        <div className="flex items-center gap-4 border-b border-rule py-2.5">
          <SkeletonText width="w-24" className="h-2.5 flex-1" />
          <SkeletonText width="w-16" className="h-2.5" />
          <SkeletonText width="w-12" className="h-2.5" />
          <SkeletonText width="w-16" className="h-2.5" />
        </div>

        <div className="divide-y divide-rule">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3.5">
              <div className="flex flex-1 items-center gap-3">
                <Skeleton className="h-8 w-8" />
                <div className="space-y-1.5">
                  <SkeletonText width="w-36" />
                  <SkeletonText width="w-16" className="h-2.5" />
                </div>
              </div>
              <SkeletonText width="w-20" />
              <Skeleton className="h-4 w-16 rounded-full" />
              <Skeleton className="h-4 w-16 rounded-full" />
              <SkeletonText width="w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
