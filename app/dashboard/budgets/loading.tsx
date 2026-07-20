import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function BudgetsLoading() {
  return (
    <div className="space-y-section">
      {/* Masthead */}
      <div className="space-y-2 border-b border-rule pb-6">
        <Skeleton className="h-8 w-40" />
        <SkeletonText width="w-96" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Set a limit */}
        <div className="lg:col-span-1 space-y-4">
          <div className="border-b border-rule pb-2">
            <SkeletonText width="w-24" className="h-2.5" />
          </div>
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-1.5">
                <SkeletonText width="w-28" className="h-2.5" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Active budgets */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border-b border-rule pb-2">
            <SkeletonText width="w-40" className="h-2.5" />
          </div>
          <div className="divide-y divide-rule">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="space-y-3 py-5">
                <div className="flex items-baseline justify-between gap-3">
                  <SkeletonText width="w-24" />
                  <SkeletonText width="w-20" className="h-2.5" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <SkeletonText width="w-20" className="h-2.5" />
                    <SkeletonText width="w-28" className="h-2.5" />
                  </div>
                  <Skeleton className="h-0.75 w-full rounded-none" />
                  <div className="flex items-center justify-between gap-2">
                    <SkeletonText width="w-12" className="h-2" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
