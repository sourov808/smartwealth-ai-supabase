export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-48 bg-zinc-900 rounded-lg" />
          <div className="h-4 w-72 bg-zinc-900/60 rounded" />
        </div>
        <div className="h-10 w-36 bg-zinc-900 rounded-lg" />
      </div>

      {/* Stats Cards Skeleton Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="border border-zinc-900 bg-zinc-900/30 rounded-2xl p-6 h-28 flex flex-col justify-between"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-2.5">
                <div className="h-3.5 w-24 bg-zinc-900 rounded" />
                <div className="h-7 w-32 bg-zinc-900 rounded-lg" />
              </div>
              <div className="h-10 w-10 bg-zinc-900 rounded-xl" />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Transactions List Feed Skeleton */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-6 w-36 bg-zinc-900 rounded" />
            <div className="h-4 w-16 bg-zinc-900/60 rounded" />
          </div>

          <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between pt-4 first:pt-0 border-t first:border-t-0 border-zinc-900/50">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-zinc-900 rounded-lg" />
                  <div className="space-y-2">
                    <div className="h-4 w-28 bg-zinc-900 rounded" />
                    <div className="h-3 w-16 bg-zinc-900/50 rounded" />
                  </div>
                </div>
                <div className="h-5 w-16 bg-zinc-900 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Budgets Tracker Summary Skeleton */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="h-6 w-32 bg-zinc-900 rounded" />
            <div className="h-4 w-16 bg-zinc-900/60 rounded" />
          </div>

          <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-6 space-y-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2.5">
                <div className="flex justify-between">
                  <div className="h-3 w-16 bg-zinc-900 rounded" />
                  <div className="h-3 w-20 bg-zinc-900/60 rounded" />
                </div>
                <div className="h-2 w-full bg-zinc-955 bg-zinc-950 rounded-full overflow-hidden">
                  <div className="h-full w-2/3 bg-zinc-900 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
