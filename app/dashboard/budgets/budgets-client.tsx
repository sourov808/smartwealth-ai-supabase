"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Sparkles,
  Plus,
  Trash2,
  AlertTriangle,
  Loader2,
  Calendar,
  DollarSign,
  TrendingDown,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

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

const EXPENSE_CATEGORIES = [
  "Food",
  "Utilities",
  "Transport",
  "Entertainment",
  "Housing",
  "Health",
  "Shopping",
  "Others",
];

interface BudgetsClientProps {
  initialBudgets: Budget[];
  initialTransactions: Transaction[];
  currentMonthYear: string;
}

export function BudgetsClient({
  initialBudgets,
  initialTransactions,
  currentMonthYear,
}: BudgetsClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [limitAmount, setLimitAmount] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!limitAmount || Number(limitAmount) <= 0) {
      alert("Please enter a valid limit amount.");
      return;
    }

    try {
      setFormLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const existing = initialBudgets.find((b) => b.category === category);

      if (existing) {
        const { error } = await supabase
          .from("budgets")
          .update({ limit_amount: Number(limitAmount) })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("budgets").insert({
          user_id: user.id,
          category,
          limit_amount: Number(limitAmount),
          month_year: currentMonthYear,
        });

        if (error) throw error;
      }

      setLimitAmount("");
      router.refresh();
    } catch (err) {
      console.error("Failed to save budget target:", err);
      alert("Failed to save budget target.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!confirm("Are you sure you want to delete this budget limit?")) return;
    try {
      const { error } = await supabase.from("budgets").delete().eq("id", id);
      if (error) throw error;
      router.refresh();
    } catch (err) {
      console.error("Failed to delete budget limit:", err);
      alert("Failed to delete budget limit.");
    }
  };

  const getCategorySpending = (categoryName: string) => {
    return initialTransactions
      .filter((tx) => tx.category === categoryName)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
  };

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
          <Sparkles className="h-7 w-7 text-foreground stroke-[1.5]" />
          <span>Category Budgets</span>
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Set monthly limit guidelines for categories to curb excessive spending.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create/Update Budget Card */}
        <div className="bg-card border border-border rounded-xl p-6 h-fit">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-foreground">
            <TrendingDown className="h-5 w-5 text-rust stroke-[1.5]" />
            <span>Set Limit Target</span>
          </h2>
          
          <form onSubmit={handleSaveBudget} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                Expense Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-card border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2.5 px-3.5 text-sm outline-none transition-all appearance-none cursor-pointer text-foreground"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-card text-foreground">
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wider mb-1.5">
                Limit Amount (USD)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-stone-400 stroke-[1.5]" />
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={limitAmount}
                  onChange={(e) => setLimitAmount(e.target.value)}
                  className="w-full bg-card border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2.5 pl-9 pr-4 text-sm outline-none transition-all placeholder:text-stone-400 text-foreground [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  required
                  min="1"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={formLoading}
              className="w-full bg-foreground text-background font-semibold py-2.5 rounded-lg flex items-center justify-center gap-2 text-sm cursor-pointer hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
            >
              {formLoading ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <Plus className="h-4.5 w-4.5 stroke-[2]" />
              )}
              <span>Save Budget Limit</span>
            </button>
          </form>
        </div>

        {/* Existing Budgets Trackers */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2 text-foreground">
            <Calendar className="h-5 w-5 text-foreground stroke-[1.5]" />
            <span>Active Budgets ({currentMonthYear})</span>
          </h2>

          {initialBudgets.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-stone-500 text-sm">
              No budgets established for this month. Set a budget limit using the form on the left.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {initialBudgets.map((bg) => {
                const spent = getCategorySpending(bg.category);
                const limit = Number(bg.limit_amount);
                const percent = limit > 0 ? Math.min(Math.round((spent / limit) * 100), 100) : 0;
                const isNearLimit = percent >= 80;
                const isOver = spent > limit;

                return (
                  <div
                    key={bg.id}
                    className="bg-card border border-border hover:border-stone-300 dark:hover:border-stone-700 rounded-xl p-6 space-y-4 flex flex-col justify-between group transition-all"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                          {bg.category}
                        </h3>
                        <p className="text-[10px] text-stone-400 dark:text-stone-500 font-semibold mt-0.5">
                          {bg.month_year} LIMIT
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteBudget(bg.id)}
                        className="p-1.5 text-stone-400 hover:text-rust hover:bg-stone-100 dark:hover:bg-stone-800 rounded opacity-0 group-hover:opacity-100 border border-transparent hover:border-border transition-all cursor-pointer"
                        title="Delete Budget"
                      >
                        <Trash2 className="h-4 w-4 stroke-[1.5]" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-end">
                        <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Spent so far</span>
                        <div className="text-sm font-bold text-stone-800 dark:text-stone-200">
                          {formatCurrency(spent)}{" "}
                          <span className="text-stone-400 dark:text-stone-400 font-medium">/ {formatCurrency(limit)}</span>
                        </div>
                      </div>

                      {/* Progress bar container */}
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

                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] font-semibold text-stone-500 dark:text-stone-400">
                          {percent}% Used
                        </span>
                        {isOver ? (
                          <span className="flex items-center gap-1 text-[10px] text-rust font-bold">
                            <AlertTriangle className="h-3 w-3 stroke-[1.5]" />
                            Over Limit
                          </span>
                        ) : isNearLimit ? (
                          <span className="flex items-center gap-1 text-[10px] text-amber-brand font-bold">
                            <AlertTriangle className="h-3 w-3 stroke-[1.5]" />
                            Warning (80%+)
                          </span>
                        ) : (
                          <span className="text-[10px] text-sage font-bold">
                            On Track
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
