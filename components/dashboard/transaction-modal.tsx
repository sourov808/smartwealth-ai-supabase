"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "motion/react";
import { X, Loader2, DollarSign, Calendar, Tag, FileText } from "lucide-react";

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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-stone-900/40"
          />

          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
            transition={{ type: "spring", duration: 0.25 }}
            className="relative w-full max-w-md bg-card border border-border rounded-xl p-6 shadow-xl z-10 text-foreground"
          >
            {/* Close Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onClose}
              className="absolute right-4 top-4 p-1 rounded text-stone-400 hover:text-foreground hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer border border-transparent hover:border-border"
            >
              <X className="h-5 w-5 stroke-[1.5]" />
            </motion.button>

            <h2 className="text-xl font-bold mb-5 text-foreground">
              {editData ? "Edit Transaction" : "Add Transaction"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 text-xs bg-rust-light/30 border border-rust/20 text-rust rounded-lg">
                  {error}
                </div>
              )}

              {/* Type Toggle */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100/50 dark:bg-stone-900/60 rounded-lg border border-border">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => {
                    setType("expense");
                    if (!editData) {
                      setCategory(EXPENSE_CATEGORIES[0]);
                    }
                  }}
                  className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    type === "expense"
                      ? "bg-rust text-white shadow-sm font-bold"
                      : "text-stone-500 hover:text-foreground"
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
                  className={`py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    type === "income"
                      ? "bg-sage text-white shadow-sm font-bold"
                      : "text-stone-500 hover:text-foreground"
                  }`}
                >
                  Income
                </motion.button>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
                  Amount
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 stroke-[1.5]" />
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-card border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2 pl-9 pr-4 text-sm outline-none transition-all placeholder:text-stone-400 text-foreground"
                    required
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
                  Category
                </label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none stroke-[1.5]" />
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-card border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2 pl-9 pr-4 text-sm outline-none transition-all appearance-none cursor-pointer text-foreground"
                  >
                    {(type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(
                      (cat) => (
                        <option key={cat} value={cat} className="bg-card text-foreground">
                          {cat}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
                  Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 stroke-[1.5]" />
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-card border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2 pl-9 pr-4 text-sm outline-none transition-all text-foreground"
                    required
                  />
                </div>
              </div>

              {/* Recurring */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
                  Recurring Interval
                </label>
                <select
                  value={recurringInterval}
                  onChange={(e) => setRecurringInterval(e.target.value)}
                  className="w-full bg-card border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2 px-3 text-sm outline-none transition-all cursor-pointer text-foreground"
                >
                  <option value="none" className="bg-card">None</option>
                  <option value="daily" className="bg-card">Daily</option>
                  <option value="weekly" className="bg-card">Weekly</option>
                  <option value="monthly" className="bg-card">Monthly</option>
                  <option value="yearly" className="bg-card">Yearly</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1">
                  Description (Optional)
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-stone-400 stroke-[1.5]" />
                  <textarea
                    rows={2}
                    placeholder="e.g. Weekly grocery shopping"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-card border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2 pl-9 pr-4 text-sm outline-none transition-all placeholder:text-stone-400 resize-none text-foreground"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 text-sm font-semibold rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer border border-transparent hover:border-border"
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={loading ? {} : { scale: 1.02 }}
                  whileTap={loading ? {} : { scale: 0.98 }}
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 text-sm font-semibold rounded-lg bg-foreground text-background flex items-center justify-center gap-1 shadow-sm cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editData ? (
                    "Save Changes"
                  ) : (
                    "Add"
                  )}
                </motion.button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
