"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { TransactionModal } from "@/components/dashboard/transaction-modal";
import { Plus, Search, Filter, Trash2, Edit2, Tag } from "lucide-react";

import { PageHeader } from "@/components/ui/stack";
import { Button, IconButton } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/field";
import { CategoryMark, Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Empty } from "@/components/ui/empty";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { fadeUp, stagger } from "@/lib/motion";
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

interface TransactionsClientProps {
  initialTransactions: Transaction[];
}

export function TransactionsClient({ initialTransactions }: TransactionsClientProps) {
  const router = useRouter();
  const supabase = createClient();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "expense" | "income">("all");
  const [categoryFilter, setCategoryFilter] = useState("All");

  // Modal Control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<Transaction | null>(null);

  const { confirm, dialog } = useConfirm();

  const handleDelete = async (tx: Transaction) => {
    const ok = await confirm({
      title: "Delete this transaction?",
      // Naming the row makes a mis-click recoverable before it happens rather
      // than after. "Are you sure?" tells the user nothing they can check.
      description: `${tx.description || tx.category} · ${formatCurrency(
        Number(tx.amount)
      )} on ${tx.date}. This cannot be undone.`,
      confirmLabel: "Delete",
      tone: "danger",
    });

    if (!ok) return;

    try {
      const { error } = await supabase.from("transactions").delete().eq("id", tx.id);
      if (error) throw error;
      router.refresh();
    } catch (err) {
      console.error("Failed to delete transaction:", err);
      await confirm({
        title: "Could not delete",
        description: "The transaction was not removed. Check your connection and try again.",
        mode: "notice",
      });
    }
  };

  const filteredTransactions = initialTransactions.filter((tx) => {
    const matchesSearch =
      (tx.description || "").toLowerCase().includes(search.toLowerCase()) ||
      tx.category.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === "all" || tx.type === typeFilter;

    const matchesCategory =
      categoryFilter === "All" || tx.category === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <div className="space-y-section">
      <PageHeader
        title="Transactions"
        description="View, search, filter and manage all your historical incomes and expenses."
      >
        <Button
          size="sm"
          onClick={() => {
            setEditData(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          <span>Add Transaction</span>
        </Button>
      </PageHeader>

      {/* Filters — an inline row of underlined controls, no box */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="sm:flex-1">
          <Field
            label="Search"
            icon={Search}
            type="text"
            placeholder="Description or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="sm:w-44 sm:shrink-0">
          <SelectField
            label="Type"
            icon={Filter}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as "all" | "expense" | "income")}
          >
            <option value="all">All Types</option>
            <option value="expense">Expenses</option>
            <option value="income">Incomes</option>
          </SelectField>
        </div>

        <div className="sm:w-44 sm:shrink-0">
          <SelectField
            label="Category"
            icon={Tag}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat === "All" ? "All Categories" : cat}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {/* Ledger */}
      {filteredTransactions.length === 0 ? (
        <Empty
          title="Nothing on the ledger"
          description="No transactions match the current search and filters."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-rule">
                <th className="eyebrow py-2.5 pr-4">Transaction</th>
                <th className="eyebrow py-2.5 pr-4">Date</th>
                <th className="eyebrow py-2.5 pr-4">Type</th>
                <th className="eyebrow py-2.5 pr-4">Interval</th>
                <th className="eyebrow py-2.5 pr-4 text-right">Amount</th>
                <th className="eyebrow py-2.5 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <motion.tbody
              variants={stagger}
              initial="hidden"
              animate="visible"
              className="divide-y divide-rule"
            >
              {filteredTransactions.map((tx) => {
                const isExpense = tx.type === "expense";
                return (
                  <motion.tr
                    key={tx.id}
                    variants={fadeUp}
                    className="group transition-colors hover:bg-paper-sunken"
                  >
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-3">
                        <CategoryMark
                          category={tx.category}
                          direction={isExpense ? "neg" : "pos"}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">
                            {tx.description || tx.category}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-faint">{tx.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 pr-4 text-sm text-ink-faint tabular whitespace-nowrap">
                      {tx.date}
                    </td>
                    <td className="py-3.5 pr-4">
                      <Badge tone={isExpense ? "neg" : "pos"}>{tx.type}</Badge>
                    </td>
                    <td className="py-3.5 pr-4">
                      <Badge tone="neutral">
                        {tx.recurring_interval === "none"
                          ? "One-time"
                          : tx.recurring_interval}
                      </Badge>
                    </td>
                    <td className="py-3.5 pr-4 text-right text-sm whitespace-nowrap">
                      <Money
                        amount={tx.amount}
                        signed
                        direction={isExpense ? "neg" : "pos"}
                      />
                    </td>
                    <td className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <IconButton
                          onClick={() => {
                            setEditData(tx);
                            setIsModalOpen(true);
                          }}
                          title="Edit"
                          aria-label="Edit transaction"
                        >
                          <Edit2 className="h-4 w-4" strokeWidth={1.5} />
                        </IconButton>
                        <IconButton
                          variant="danger"
                          onClick={() => handleDelete(tx)}
                          title="Delete"
                          aria-label="Delete transaction"
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                        </IconButton>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </motion.tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditData(null);
        }}
        onSuccess={() => router.refresh()}
        editData={editData}
      />

      {dialog}
    </div>
  );
}
