export default function TransactionsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-60 bg-zinc-900 rounded-lg" />
          <div className="h-4 w-80 bg-zinc-900/60 rounded" />
        </div>
        <div className="h-10 w-36 bg-zinc-900 rounded-lg" />
      </div>

      {/* Filter and Search Bar Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-zinc-900/30 border border-zinc-900 rounded-2xl">
        <div className="md:col-span-2 h-10 bg-zinc-900 rounded-lg" />
        <div className="h-10 bg-zinc-900 rounded-lg" />
        <div className="h-10 bg-zinc-900 rounded-lg" />
      </div>

      {/* Main Ledger Table Skeleton */}
      <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-zinc-900 flex justify-between">
          <div className="h-4 w-32 bg-zinc-900 rounded" />
          <div className="h-4 w-20 bg-zinc-900/60 rounded" />
        </div>
        <div className="p-6 space-y-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center justify-between pt-4 first:pt-0 border-t first:border-t-0 border-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-zinc-900 rounded-lg" />
                <div className="space-y-2">
                  <div className="h-4 w-36 bg-zinc-900 rounded" />
                  <div className="h-3 w-16 bg-zinc-900/50 rounded" />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="h-4 w-20 bg-zinc-900 rounded" />
                <div className="h-4 w-12 bg-zinc-900/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
