import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { AnalyticsData } from "./analytics-data";

export default function AnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-6 w-6 text-stone-400 animate-spin" />
          <p className="text-stone-500 text-sm">Computing analytical trends...</p>
        </div>
      }
    >
      <AnalyticsData />
    </Suspense>
  );
}
