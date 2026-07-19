import { createClient } from "@/lib/supabase/server";
import { TransactionsClient } from "./transactions-client";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  description: string | null;
  date: string;
  recurring_interval: string;
}

export async function TransactionsData() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false });

  if (error) {
    console.error("Error fetching transactions ledger:", error);
  }

  const transactions = (data || []) as Transaction[];

  return <TransactionsClient initialTransactions={transactions} />;
}
