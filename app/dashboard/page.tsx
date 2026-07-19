import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { DashboardData } from "./dashboard-data";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
          <Loader2 className="h-6 w-6 text-stone-400 animate-spin" />
          <p className="text-stone-500 text-sm">Loading financial intelligence...</p>
        </div>
      }
    >
      <DashboardData />
    </Suspense>
  );
}
