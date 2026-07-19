import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { BudgetsData } from "./budgets-data";

export default function BudgetsPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-card border border-border rounded-xl p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-6 w-6 text-stone-400 animate-spin" />
          <p className="text-stone-500 text-sm">Evaluating budgets...</p>
        </div>
      }
    >
      <BudgetsData />
    </Suspense>
  );
}
