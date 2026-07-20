import { Skeleton, SkeletonText, SkeletonRow } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-section">
      {/* Masthead */}
      <div className="flex flex-col gap-4 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <SkeletonText width="w-32" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>

      {/* Hero figure + supporting row */}
      <div className="space-y-block">
        <div className="space-y-2">
          <SkeletonText width="w-24" className="h-2.5" />
          <Skeleton className="h-14 w-64" />
          <SkeletonText width="w-48" className="h-2.5" />
        </div>

        <div className="grid grid-cols-1 gap-8 border-t border-rule pt-block sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <SkeletonText width="w-24" className="h-2.5" />
              <Skeleton className="h-8 w-32" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Recent */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
            <SkeletonText width="w-20" className="h-2.5" />
            <SkeletonText width="w-14" className="h-2.5" />
          </div>
          <div className="divide-y divide-rule">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>

        {/* Budgets */}
        <div className="space-y-4">
          <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
            <SkeletonText width="w-20" className="h-2.5" />
            <SkeletonText width="w-14" className="h-2.5" />
          </div>
          <div className="space-y-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <SkeletonText width="w-20" className="h-2.5" />
                  <SkeletonText width="w-24" className="h-2.5" />
                </div>
                <Skeleton className="h-[3px] w-full rounded-none" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Gmail row */}
      <div className="flex items-center justify-between gap-3 border-t border-rule pt-4">
        <SkeletonText width="w-56" />
        <Skeleton className="h-7 w-24" />
      </div>
    </div>
  );
}
