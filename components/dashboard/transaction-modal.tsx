"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, DollarSign, Calendar, Tag } from "lucide-react";

import { Surface } from "@/components/ui/surface";
import { Button, IconButton } from "@/components/ui/button";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { modalPop, scrim } from "@/lib/motion";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editData?: {
    id: string;
    amount: number;
    type: string;
    category: string;
    description: string | null;
    date: string;
    recurring_interval: string;
  } | null;
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

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Investment",
  "Gift",
  "Others",
];

export function TransactionModal({
  isOpen,
  onClose,
  onSuccess,
  editData = null,
}: TransactionModalProps) {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<"expense" | "income">("expense");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [recurringInterval, setRecurringInterval] = useState("none");

  // Keep track of props to sync state during render (standard React pattern)
  const [prevEditData, setPrevEditData] = useState<typeof editData>(null);
  const [prevIsOpen, setPrevIsOpen] = useState(false);

  if (editData !== prevEditData || isOpen !== prevIsOpen) {
    setPrevEditData(editData);
    setPrevIsOpen(isOpen);
    if (editData) {
      setAmount(editData.amount.toString());
      setType(editData.type as "expense" | "income");
      setCategory(editData.category);
      setDescription(editData.description || "");
      setDate(editData.date);
      setRecurringInterval(editData.recurring_interval);
    } else {
      setAmount("");
      setType("expense");
      setCategory(EXPENSE_CATEGORIES[0]);
      setDescription("");
      setDate(new Date().toISOString().split("T")[0]);
      setRecurringInterval("none");
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Please enter a valid amount greater than 0");
      setLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("User session not found.");

      const payload = {
        user_id: user.id,
        amount: numAmount,
        type,
        category,
        description: description.trim() || null,
        date,
        recurring_interval: recurringInterval,
      };

      if (editData) {
        // Update transaction
        const { error: updateError } = await supabase
          .from("transactions")
          .update(payload)
          .eq("id", editData.id);

        if (updateError) throw updateError;
      } else {
        // Insert transaction
        const { error: insertError } = await supabase
          .from("transactions")
          .insert(payload);

        if (insertError) throw insertError;
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save transaction.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop — flat scrim, no blur */}
          <motion.div
            variants={scrim}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-ink/30"
          />

          {/* Modal Content */}
          <motion.div
            variants={modalPop}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="relative z-10 w-full max-w-md"
          >
            <Surface variant="raised" className="p-6 text-ink">
              {/* Close Button */}
              <IconButton
                variant="quiet"
                onClick={onClose}
                aria-label="Close"
                className="absolute right-4 top-4"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </IconButton>

              <h2 className="display mb-6 text-2xl text-ink">
                {editData ? "Edit Transaction" : "Add Transaction"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div className="border-l-2 border-neg bg-neg-soft py-2.5 pr-3 pl-4 text-xs text-neg">
                    {error}
                  </div>
                )}

                {/* Type Toggle */}
                <div className="grid grid-cols-2 gap-px border border-rule bg-rule">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => {
                      setType("expense");
                      if (!editData) {
                        setCategory(EXPENSE_CATEGORIES[0]);
                      }
                    }}
                    className={`cursor-pointer py-2 text-xs font-medium transition-colors ${
                      type === "expense"
                        ? "bg-neg text-paper"
                        : "bg-paper text-ink-muted hover:text-ink"
                    }`}
                  >
                    Expense
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => {
                      setType("income");
                      if (!editData) {
                        setCategory(INCOME_CATEGORIES[0]);
                      }
                    }}
                    className={`cursor-pointer py-2 text-xs font-medium transition-colors ${
                      type === "income"
                        ? "bg-pos text-paper"
                        : "bg-paper text-ink-muted hover:text-ink"
                    }`}
                  >
                    Income
                  </motion.button>
                </div>

                {/* Amount */}
                <Field
                  label="Amount"
                  icon={DollarSign}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />

                {/* Category */}
                <SelectField
                  label="Category"
                  icon={Tag}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {(type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(
                    (cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    )
                  )}
                </SelectField>

                {/* Date */}
                <Field
                  label="Date"
                  icon={Calendar}
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />

                {/* Recurring */}
                <SelectField
                  label="Recurring Interval"
                  value={recurringInterval}
                  onChange={(e) => setRecurringInterval(e.target.value)}
                >
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </SelectField>

                {/* Description */}
                <TextareaField
                  label="Description (Optional)"
                  rows={2}
                  placeholder="e.g. Weekly grocery shopping"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={onClose}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    type="submit"
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : editData ? (
                      "Save Changes"
                    ) : (
                      "Add"
                    )}
                  </Button>
                </div>
              </form>
            </Surface>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
