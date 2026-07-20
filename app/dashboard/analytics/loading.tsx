import { Skeleton, SkeletonText } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-10">
      {/* Masthead */}
      <div className="flex flex-col gap-4 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-44" />
          <SkeletonText width="w-80" />
        </div>
        <div className="space-y-2">
          <SkeletonText width="w-20" className="h-2.5" />
          <Skeleton className="h-8 w-full sm:w-52" />
        </div>
      </div>

      {/* KPI band */}
      <div className="grid grid-cols-2 gap-8 border-b border-rule pb-8 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <SkeletonText width="w-24" className="h-2.5" />
            <Skeleton className="h-9 w-32" />
            <SkeletonText width="w-28" className="h-2.5" />
          </div>
        ))}
      </div>

      {/* Trend chart */}
      <section className="space-y-4">
        <div className="border-b border-rule pb-2">
          <SkeletonText width="w-24" className="h-2.5" />
        </div>
        <div className="flex h-80 w-full items-end justify-between gap-1.5">
          {[30, 80, 45, 60, 90, 40, 75, 50, 65, 85, 35, 70].map((h, i) => (
            <Skeleton key={i} className="w-[6%]" style={{ height: `${h}%` }} />
          ))}
        </div>
      </section>

      {/* Two-up charts */}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="border-b border-rule pb-2">
            <SkeletonText width="w-32" className="h-2.5" />
          </div>
          <div className="flex h-70 w-full items-end justify-around">
            {[50, 80].map((h, i) => (
              <Skeleton key={i} className="w-11" style={{ height: `${h}%` }} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="border-b border-rule pb-2">
            <SkeletonText width="w-36" className="h-2.5" />
          </div>
          <div className="flex min-h-70 flex-col items-center justify-between gap-6 sm:flex-row">
            <Skeleton className="h-55 w-55 shrink-0 rounded-full" />
            <div className="w-full flex-1 divide-y divide-rule">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center justify-between gap-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-2.5 w-2.5 rounded-none" />
                    <SkeletonText width="w-24" className="h-2.5" />
                  </div>
                  <SkeletonText width="w-16" className="h-2.5" />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
