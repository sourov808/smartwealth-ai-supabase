export default function AnalyticsLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-56 bg-zinc-900 rounded-lg" />
        <div className="h-4 w-96 bg-zinc-900/60 rounded" />
      </div>

      <div className="space-y-8">
        {/* Large Chart Skeleton */}
        <div className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-6 h-[380px] space-y-6">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 bg-zinc-900 rounded" />
            <div className="h-6 w-48 bg-zinc-900 rounded" />
          </div>
          {/* Simulated chart canvas */}
          <div className="flex-1 h-60 bg-zinc-950/40 rounded-xl border border-zinc-900/60 flex items-end justify-between p-4">
            {[30, 80, 45, 60, 90, 40, 75, 50, 65, 85, 35, 70].map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className="w-[6%] bg-zinc-900/50 rounded-t"
              />
            ))}
          </div>
        </div>

        {/* Small Charts Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {[1, 2].map((i) => (
            <div key={i} className="bg-zinc-900/30 border border-zinc-900 rounded-2xl p-6 h-[340px] space-y-5">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-zinc-900 rounded" />
                <div className="h-6 w-40 bg-zinc-900 rounded" />
              </div>
              <div className="h-52 bg-zinc-950/40 rounded-xl border border-zinc-900/60 flex items-center justify-center">
                {/* Simulated circular pie chart skeleton for card 2 */}
                {i === 2 ? (
                  <div className="h-32 w-32 rounded-full border-8 border-zinc-900/60 flex items-center justify-center">
                    <div className="h-16 w-16 rounded-full bg-zinc-950/20" />
                  </div>
                ) : (
                  <div className="w-full h-full flex items-end justify-around p-6">
                    {[50, 80, 30].map((h, idx) => (
                      <div
                        key={idx}
                        style={{ height: `${h}%` }}
                        className="w-16 bg-zinc-900/50 rounded-t"
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
