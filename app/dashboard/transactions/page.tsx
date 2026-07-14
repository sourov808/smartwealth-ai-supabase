"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { TransactionModal } from "@/components/dashboard/transaction-modal";
import {
  Receipt,
  Plus,
  Search,
  Filter,
  Trash2,
  Edit2,
  Calendar,
  Loader2,
  Tag,
} from "lucide-react";
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

const CATEGORIES = [
  "All",
  "Food",
  "Utilities",
  "Transport",
  "Entertainment",
  "Housing",
  "Health",
  "Shopping",
  "Salary",
  "Freelance",
  "Investment",
  "Gift",
  "Others",
];

export default function TransactionsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">("all");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Modal Control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<Transaction | null>(null);

  const fetchTransactions = useCallback(async () => {
    // Defer state settings to avoid synchronous React warning during render phase
    await Promise.resolve();
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .order("date", { ascending: false });

      if (error) throw error;
      setTransactions((data || []) as Transaction[]);
    } catch (err) {
      console.error("Error loading transactions:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    try {
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      fetchTransactions();
    } catch (err) {
      console.error("Failed to delete transaction:", err);
      alert("Failed to delete transaction.");
    }
  };

  // Filter transactions based on search and selected options
  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      (tx.description || "").toLowerCase().includes(search.toLowerCase()) ||
      tx.category.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === "all" || tx.type === typeFilter;

    const matchesCategory =
      categoryFilter === "All" || tx.category === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <div className="space-y-8">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Receipt className="h-7 w-7 text-foreground stroke-[1.5]" />
            <span>Transactions Ledger</span>
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            View, search, filter and manage all your historical incomes and expenses.
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

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-card border border-border rounded-xl">
        {/* Search */}
        <div className="md:col-span-2 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 stroke-[1.5]" />
          <input
            type="text"
            placeholder="Search description or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2.5 pl-9 pr-4 text-sm outline-none transition-all placeholder:text-stone-400 text-foreground"
          />
        </div>

        {/* Type Filter */}
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none stroke-[1.5]" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "all" | "expense" | "income")}
            className="w-full bg-card border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2.5 pl-9 pr-4 text-sm outline-none transition-all appearance-none cursor-pointer text-foreground"
          >
            <option value="all" className="bg-card">All Types</option>
            <option value="expense" className="bg-card">Expenses</option>
            <option value="income" className="bg-card">Incomes</option>
          </select>
        </div>

        {/* Category Filter */}
        <div className="relative">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400 pointer-events-none stroke-[1.5]" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-card border border-border focus:border-foreground focus:ring-1 focus:ring-foreground rounded-lg py-2.5 pl-9 pr-4 text-sm outline-none transition-all appearance-none cursor-pointer text-foreground"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat} className="bg-card">
                {cat === "All" ? "All Categories" : cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Ledger Table/Cards */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-6 w-6 text-stone-400 animate-spin" />
            <p className="text-stone-500 text-sm">Retrieving transactions...</p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="text-center py-16 text-stone-500 text-sm">
            No matching transactions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-semibold text-stone-500 uppercase tracking-wider bg-stone-50 dark:bg-stone-900/50">
                  <th className="px-6 py-4">Transaction / Category</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Interval</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredTransactions.map((tx) => {
                  const isExpense = tx.type === "expense";
                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-stone-50/50 dark:hover:bg-stone-900/10 transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-xs border ${
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
                            <p className="text-xs text-stone-400 dark:text-stone-400 mt-0.5">
                              {tx.category}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-700 dark:text-stone-300">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-stone-400 dark:text-stone-500 stroke-[1.5]" />
                          <span>{tx.date}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            isExpense
                              ? "bg-rust-light border-rust/15 text-rust"
                              : "bg-sage-light border-sage/15 text-sage"
                          }`}
                        >
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-600 dark:text-stone-400 capitalize">
                        {tx.recurring_interval === "none"
                          ? "One-time"
                          : tx.recurring_interval}
                      </td>
                      <td
                        className={`px-6 py-4 text-right text-sm font-bold ${
                          isExpense ? "text-rust" : "text-sage"
                        }`}
                      >
                        <div className="flex items-center justify-end gap-0.5">
                          {isExpense ? "-" : "+"}
                          {formatCurrency(tx.amount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditData(tx);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-stone-400 hover:text-foreground dark:hover:text-stone-200 rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer border border-transparent hover:border-border"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4 stroke-[1.5]" />
                          </button>
                          <button
                            onClick={() => handleDelete(tx.id)}
                            className="p-1.5 text-stone-400 hover:text-rust rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer border border-transparent hover:border-border"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4 stroke-[1.5]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditData(null);
        }}
        onSuccess={fetchTransactions}
        editData={editData}
      />
    </div>
  );
}
