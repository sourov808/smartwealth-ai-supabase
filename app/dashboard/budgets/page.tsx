import { Suspense } from "react";

import { Pending } from "@/components/ui/pending";
import { BudgetsData } from "./budgets-data";

export default function BudgetsPage() {
  return (
    <Suspense fallback={<Pending message="Evaluating budgets…" />}>
      <BudgetsData />
    </Suspense>
  );
}
