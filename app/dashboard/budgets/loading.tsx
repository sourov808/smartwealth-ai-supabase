export default function BudgetsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-52 bg-zinc-900 rounded-lg" />
        <div className="h-4 w-96 bg-zinc-900/60 rounded" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create/Update Budget Card Skeleton */}
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-6 h-64 space-y-5">
          <div className="h-6 w-32 bg-zinc-900 rounded" />
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="h-3 w-28 bg-zinc-900/60 rounded" />
              <div className="h-10 w-full bg-zinc-900 rounded-lg" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-24 bg-zinc-900/60 rounded" />
              <div className="h-10 w-full bg-zinc-900 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Existing Budgets Tracker Skeleton */}
        <div className="lg:col-span-2 space-y-4">
          <div className="h-6 w-44 bg-zinc-900 rounded" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-6 space-y-5 h-40 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="h-4.5 w-24 bg-zinc-900 rounded" />
                  <div className="h-3 w-16 bg-zinc-900/60 rounded" />
                </div>
                <div className="space-y-2.5">
                  <div className="flex justify-between">
                    <div className="h-3 w-16 bg-zinc-900 rounded" />
                    <div className="h-3 w-24 bg-zinc-900/60 rounded" />
                  </div>
                  <div className="h-2.5 w-full bg-zinc-950 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
