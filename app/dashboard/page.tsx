"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/dashboard/stat-card";
import { TransactionModal } from "@/components/dashboard/transaction-modal";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  Plus,
  ArrowRight,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

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

export default function DashboardPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  
  // Stats
  const [balance, setBalance] = useState(0);
  const [monthlyIncome, setMonthlyIncome] = useState(0);
  const [monthlyExpense, setMonthlyExpense] = useState(0);

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<Transaction | null>(null);

  // Load Date variables
  const now = new Date();
  const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const fetchDashboardData = useCallback(async () => {
    // Defer state settings to avoid synchronous React warning during render phase
    await Promise.resolve();
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch all transactions for stats
      const { data: txs, error: txsError } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false });

      if (txsError) throw txsError;

      // 2. Fetch budgets for the current month
      const { data: bgs, error: bgsError } = await supabase
        .from("budgets")
        .select("*")
        .eq("month_year", currentMonthYear);

      if (bgsError) throw bgsError;

      const typedTxs = (txs || []) as Transaction[];
      setTransactions(typedTxs);
      setBudgets((bgs || []) as Budget[]);

      // Compute stats
      let totalBal = 0;
      let mIncome = 0;
      let mExpense = 0;

      const localNow = new Date();
      const currentMonth = localNow.getMonth();
      const currentYear = localNow.getFullYear();

      typedTxs.forEach((tx) => {
        const amt = Number(tx.amount);
        const txDate = new Date(tx.date);
        const isCurrentMonth =
          txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;

        if (tx.type === "income") {
          totalBal += amt;
          if (isCurrentMonth) mIncome += amt;
        } else {
          totalBal -= amt;
          if (isCurrentMonth) mExpense += amt;
        }
      });

      setBalance(totalBal);
      setMonthlyIncome(mIncome);
      setMonthlyExpense(mExpense);
    } catch (err) {
      console.error("Error loading dashboard metrics:", err);
    } finally {
      setLoading(false);
    }
  }, [currentMonthYear, supabase]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      fetchDashboardData();
    } catch (err) {
      console.error("Failed to delete transaction:", err);
      alert("Failed to delete transaction.");
    }
  };

  // Group current month transactions by category for budget comparison
  const getCategorySpending = (categoryName: string) => {
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return transactions
      .filter((tx) => {
        const txDate = new Date(tx.date);
        return (
          tx.type === "expense" &&
          tx.category === categoryName &&
          txDate.getMonth() === currentMonth &&
          txDate.getFullYear() === currentYear
        );
      })
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="h-6 w-6 text-stone-400 animate-spin" />
        <p className="text-stone-500 text-sm">Loading financial intelligence...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Financial Dashboard
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Overview of your current month accounts and limits.
          </p>
        </div>
        <button
          onClick={() => {
            setEditData(null);
            setIsModalOpen(true);
          }}
          className="bg-foreground text-background font-semibold px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
        >
          <Plus className="h-4 w-4 stroke-[2]" />
          <span>Add Transaction</span>
        </button>
      </div>

      {/* Stats Summary Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Balance"
          value={balance}
          icon={Wallet}
          type="balance"
        />
        <StatCard
          title="Monthly Income"
          value={monthlyIncome}
          icon={TrendingUp}
          type="income"
          subtitle="Earned this month"
        />
        <StatCard
          title="Monthly Expenses"
          value={monthlyExpense}
          icon={TrendingDown}
          type="expense"
          subtitle="Spent this month"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Transactions List Feed */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Recent Transactions</h2>
            <Link
              href="/dashboard/transactions"
              className="text-xs font-semibold text-foreground hover:underline flex items-center gap-1 transition-all"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-4 shadow-xs">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-stone-500 text-sm">
                No transactions recorded yet. Click &quot;Add Transaction&quot; to begin.
              </div>
            ) : (
              <div className="divide-y divide-border space-y-4">
                {transactions.slice(0, 5).map((tx) => {
                  const isExpense = tx.type === "expense";
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between pt-4 first:pt-0 group/row"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-9 w-9 rounded-lg flex items-center justify-center border font-bold text-xs ${
                            isExpense
                              ? "bg-rust-light border-rust/15 text-rust"
                              : "bg-sage-light border-sage/15 text-sage"
                          }`}
                        >
                          {tx.category.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {tx.description || tx.category}
                          </p>
                          <p className="text-xs text-stone-400 dark:text-stone-400 flex items-center gap-1.5 mt-0.5">
                            <Calendar className="h-3 w-3 stroke-[1.5]" />
                            {tx.date}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span
                          className={`text-sm font-bold ${
                            isExpense ? "text-rust" : "text-sage"
                          }`}
                        >
                          {isExpense ? "-" : "+"}
                          {formatCurrency(tx.amount)}
                        </span>
                        
                        <div className="flex items-center gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditData(tx);
                              setIsModalOpen(true);
                            }}
                            className="p-1 text-stone-400 hover:text-foreground dark:hover:text-stone-200 rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer border border-transparent hover:border-border"
                          >
                            <Edit2 className="h-3.5 w-3.5 stroke-[1.5]" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="p-1 text-stone-400 hover:text-rust rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer border border-transparent hover:border-border"
                          >
                            <Trash2 className="h-3.5 w-3.5 stroke-[1.5]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Budgets Tracker Summary widget */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Category Budgets</h2>
            <Link
              href="/dashboard/budgets"
              className="text-xs font-semibold text-foreground hover:underline flex items-center gap-1 transition-colors"
            >
              <span>Manage</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="bg-card border border-border rounded-xl p-6 space-y-5 shadow-xs">
            {budgets.length === 0 ? (
              <div className="text-center py-6 text-stone-500 text-sm">
                No active budget limits configured for this month.
              </div>
            ) : (
              <div className="space-y-4">
                {budgets.slice(0, 4).map((bg) => {
                  const spent = getCategorySpending(bg.category);
                  const limit = Number(bg.limit_amount);
                  const percent = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
                  const isNearLimit = percent >= 80;
                  const isOver = spent > limit;

                  return (
                    <div key={bg.category} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-stone-700 dark:text-stone-300">{bg.category}</span>
                        <span className="text-stone-500 dark:text-stone-400">
                          {formatCurrency(spent)} /{" "}
                          <span className="text-stone-400 dark:text-stone-500">{formatCurrency(limit)}</span>
                        </span>
                      </div>
                      
                      {/* Budget Progress Bar */}
                      <div className="h-2 w-full bg-stone-100 dark:bg-stone-900 rounded-full overflow-hidden border border-border">
                        <div
                          style={{ width: `${percent}%` }}
                          className={`h-full rounded-full transition-all duration-500 ${
                            isOver
                              ? "bg-rust"
                              : isNearLimit
                              ? "bg-amber-brand"
                              : "bg-sage"
                          }`}
                        />
                      </div>

                      {isOver && (
                        <div className="flex items-center gap-1 text-[10px] text-rust font-semibold mt-0.5">
                          <AlertTriangle className="h-3 w-3 stroke-[1.5]" />
                          <span>Over budget limit!</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditData(null);
        }}
        onSuccess={fetchDashboardData}
        editData={editData}
      />
    </div>
  );
}
