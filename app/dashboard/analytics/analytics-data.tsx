import { createClient } from "@/lib/supabase/server";
import { AnalyticsClient } from "./analytics-client";

interface Transaction {
  amount: number;
  type: string;
  category: string;
  date: string;
}

export async function AnalyticsData() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("transactions")
    .select("amount, type, category, date")
    .order("date", { ascending: true });

  if (error) {
    console.error("Error fetching transactions for analytics:", error);
  }

  const transactions = (data || []) as Transaction[];

  return <AnalyticsClient initialTransactions={transactions} />;
}
