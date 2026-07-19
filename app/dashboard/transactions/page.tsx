import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { TransactionsData } from "./transactions-data";

export default function TransactionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="h-6 w-6 text-stone-400 animate-spin" />
          <p className="text-stone-500 text-sm">Retrieving transactions...</p>
        </div>
      }
    >
      <TransactionsData />
    </Suspense>
  );
}
