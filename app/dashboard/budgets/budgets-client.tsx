"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { Plus, Trash2, Loader2, DollarSign } from "lucide-react";

import { Section, PageHeader, RuledList } from "@/components/ui/stack";
import { Button, IconButton } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { Meter } from "@/components/ui/meter";
import { Empty } from "@/components/ui/empty";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { fadeUp, stagger } from "@/lib/motion";

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
  // Validation belongs next to the field that failed, not in a dialog the user
  // has to dismiss before they can fix it.
  const [formError, setFormError] = useState<string | null>(null);

  const { confirm, dialog } = useConfirm();

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!limitAmount || Number(limitAmount) <= 0) {
      setFormError("Enter an amount greater than zero.");
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
      setFormError("Could not save this limit. Check your connection and try again.");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteBudget = async (budget: Budget) => {
    const ok = await confirm({
      title: `Delete the ${budget.category} limit?`,
      description:
        "The limit is removed for this month. Your transactions in this category are not affected.",
      confirmLabel: "Delete",
      tone: "danger",
    });

    if (!ok) return;

    try {
      const { error } = await supabase.from("budgets").delete().eq("id", budget.id);
      if (error) throw error;
      router.refresh();
    } catch (err) {
      console.error("Failed to delete budget limit:", err);
      await confirm({
        title: "Could not delete",
        description: "The budget limit was not removed. Check your connection and try again.",
        mode: "notice",
      });
    }
  };

  const getCategorySpending = (categoryName: string) => {
    return initialTransactions
      .filter((tx) => tx.category === categoryName)
      .reduce((sum, tx) => sum + Number(tx.amount), 0);
  };

  return (
    <div className="space-y-section">
      <PageHeader
        title="Budgets"
        description="Set monthly limit guidelines for categories to curb excessive spending."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Set a limit */}
        <Section label="set a limit" className="lg:col-span-1 h-fit">
          <form onSubmit={handleSaveBudget} className="space-y-6">
            <SelectField
              label="Expense Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </SelectField>

            <Field
              label="Limit Amount (USD)"
              icon={DollarSign}
              type="number"
              placeholder="e.g. 500"
              value={limitAmount}
              onChange={(e) => setLimitAmount(e.target.value)}
              required
              min="1"
              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />

            {formError && (
              <p
                role="alert"
                className="border-l-2 border-neg bg-neg-soft px-3 py-2 text-xs text-neg"
              >
                {formError}
              </p>
            )}

            <Button type="submit" disabled={formLoading} className="w-full">
              {formLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" strokeWidth={2} />
              )}
              <span>Save Budget Limit</span>
            </Button>
          </form>
        </Section>

        {/* Active budgets */}
        <Section
          label={`active budgets (${currentMonthYear})`}
          className="lg:col-span-2"
        >
          {initialBudgets.length === 0 ? (
            <Empty
              title="No budgets yet"
              description="Nothing is budgeted for this month. Set a limit using the form on the left."
            />
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="visible">
              <RuledList>
                {initialBudgets.map((bg) => {
                  const spent = getCategorySpending(bg.category);
                  const limit = Number(bg.limit_amount);

                  return (
                    <motion.div
                      key={bg.id}
                      variants={fadeUp}
                      className="group flex items-start gap-4 py-5"
                    >
                      <div className="min-w-0 flex-1 space-y-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <h3 className="text-sm font-medium text-ink">
                            {bg.category}
                          </h3>
                          <span className="eyebrow text-ink-faint">
                            {bg.month_year} limit
                          </span>
                        </div>

                        <Meter
                          label="Spent so far"
                          spent={spent}
                          limit={limit}
                          showStatus
                        />
                      </div>

                      <IconButton
                        variant="quiet"
                        onClick={() => handleDeleteBudget(bg)}
                        title="Delete Budget"
                        className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                      </IconButton>
                    </motion.div>
                  );
                })}
              </RuledList>
            </motion.div>
          )}
        </Section>
      </div>

      {dialog}
    </div>
  );
}
