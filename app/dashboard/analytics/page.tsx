import { Suspense } from "react";

import { Pending } from "@/components/ui/pending";
import { AnalyticsData } from "./analytics-data";

export default function AnalyticsPage() {
  return (
    <Suspense fallback={<Pending message="Computing trends…" />}>
      <AnalyticsData />
    </Suspense>
  );
}
