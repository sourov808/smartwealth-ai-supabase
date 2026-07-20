import { Suspense } from "react";

import { Pending } from "@/components/ui/pending";
import { DashboardData } from "./dashboard-data";

export default function DashboardPage() {
  return (
    <Suspense fallback={<Pending message="Loading your overview…" />}>
      <DashboardData />
    </Suspense>
  );
}
