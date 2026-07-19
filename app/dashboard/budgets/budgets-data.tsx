import { createClient } from "@/lib/supabase/server";
import { BudgetsClient } from "./budgets-client";

interface Budget {
  id: string;
  category: string;
  limit_amount: number;
  month_year: string;
}

interface Transaction {
  category: string;
  amount: number;
  type: string;
  date: string;
}

export async function BudgetsData() {
  const supabase = await createClient();

  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 1. Fetch budgets for the current month
  const { data: bgs, error: bgsError } = await supabase
    .from("budgets")
    .select("*")
    .eq("month_year", currentMonthYear);

  if (bgsError) {
    console.error("Error fetching budgets:", bgsError);
  }

  // 2. Fetch current month expense transactions to calculate spending
  const startOfMonth = `${currentMonthYear}-01`;
  const nextMonth = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
  const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
  const endOfMonth = `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-01`;

  const { data: txs, error: txsError } = await supabase
    .from("transactions")
    .select("category, amount, type, date")
    .eq("type", "expense")
    .gte("date", startOfMonth)
    .lt("date", endOfMonth);

  if (txsError) {
    console.error("Error fetching transactions for budgets:", txsError);
  }

  const budgets = (bgs || []) as Budget[];
  const transactions = (txs || []) as Transaction[];

  return (
    <BudgetsClient
      initialBudgets={budgets}
      initialTransactions={transactions}
      currentMonthYear={currentMonthYear}
    />
  );
}
