import { createClient } from "@/lib/supabase/server";
import { DashboardClient } from "./dashboard-client";

interface Transaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  description: string | null;
  date: string;
  recurring_interval: string;
}

interface Budget {
  category: string;
  limit_amount: number;
  month_year: string;
}

export async function DashboardData() {
  const supabase = await createClient();

  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // 1. Fetch all transactions
  const { data: txs, error: txsError } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false });

  if (txsError) {
    console.error("Error fetching transactions:", txsError);
  }

  // 2. Fetch budgets for the current month
  const { data: bgs, error: bgsError } = await supabase
    .from("budgets")
    .select("*")
    .eq("month_year", currentMonthYear);

  if (bgsError) {
    console.error("Error fetching budgets:", bgsError);
  }

  const transactions = (txs || []) as Transaction[];
  const budgets = (bgs || []) as Budget[];

  // Compute stats
  let balance = 0;
  let monthlyIncome = 0;
  let monthlyExpense = 0;

  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  transactions.forEach((tx) => {
    const amt = Number(tx.amount);
    const txDate = new Date(tx.date);
    const isCurrentMonth =
      txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;

    if (tx.type === "income") {
      balance += amt;
      if (isCurrentMonth) monthlyIncome += amt;
    } else {
      balance -= amt;
      if (isCurrentMonth) monthlyExpense += amt;
    }
  });

  return (
    <DashboardClient
      initialTransactions={transactions}
      initialBudgets={budgets}
      balance={balance}
      monthlyIncome={monthlyIncome}
      monthlyExpense={monthlyExpense}
    />
  );
}
