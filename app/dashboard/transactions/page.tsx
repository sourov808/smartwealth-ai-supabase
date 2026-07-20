import { Suspense } from "react";

import { Pending } from "@/components/ui/pending";
import { TransactionsData } from "./transactions-data";

export default function TransactionsPage() {
  return (
    <Suspense fallback={<Pending message="Retrieving transactions…" />}>
      <TransactionsData />
    </Suspense>
  );
}
