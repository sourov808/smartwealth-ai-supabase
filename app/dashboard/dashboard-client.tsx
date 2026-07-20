"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Plus, Edit2, Trash2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { GmailConnection } from "@/components/dashboard/gmail-connection";
import { TransactionModal } from "@/components/dashboard/transaction-modal";
import { Section, PageHeader, RuledList } from "@/components/ui/stack";
import { Figure } from "@/components/ui/figure";
import { Button, IconButton } from "@/components/ui/button";
import { CategoryMark } from "@/components/ui/badge";
import { Meter } from "@/components/ui/meter";
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

interface Budget {
  category: string;
  limit_amount: number;
  month_year: string;
}

interface DashboardClientProps {
  initialTransactions: Transaction[];
  initialBudgets: Budget[];
  balance: number;
  monthlyIncome: number;
  monthlyExpense: number;
}

export function DashboardClient({
  initialTransactions,
  initialBudgets,
  balance,
  monthlyIncome,
  monthlyExpense,
}: DashboardClientProps) {
  const router = useRouter();
  const supabase = createClient();

  // Modal control
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<Transaction | null>(null);

  const { confirm, dialog } = useConfirm();

  const now = new Date();

  const monthLabel = now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const handleDelete = async (tx: Transaction) => {
    const ok = await confirm({
      title: "Delete this transaction?",
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

  // Group current month transactions by category for budget comparison
  const getCategorySpending = (categoryName: string) => {
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return initialTransactions
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

  const netSaved = monthlyIncome - monthlyExpense;

  return (
    <div className="space-y-section">
      <PageHeader title="Overview" description={monthLabel}>
        <Button
          size="sm"
          onClick={() => {
            setEditData(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>Add transaction</span>
        </Button>
      </PageHeader>

      {/* Hero balance + the month's three supporting figures */}
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="space-y-block"
      >
        <Figure
          size="display"
          label="total balance"
          value={balance}
          hint={`Across all accounts as of ${monthLabel}`}
        />

        <div className="border-t border-rule pt-block">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            <Figure label="monthly income" value={monthlyIncome} tone="pos" />
            <Figure label="monthly expenses" value={monthlyExpense} tone="neg" />
            <Figure
              label="net saved"
              value={netSaved}
              tone={netSaved < 0 ? "neg" : "pos"}
              hint="Income less expenses this month"
            />
          </div>
        </div>
      </motion.div>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Recent Transactions List Feed */}
        <Section
          label="recent"
          action={{ href: "/dashboard/transactions", label: "View all" }}
          className="lg:col-span-2"
        >
          {initialTransactions.length === 0 ? (
            <Empty
              title="Nothing recorded yet"
              description="Add your first transaction to start the ledger."
              action={
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditData(null);
                    setIsModalOpen(true);
                  }}
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                  <span>Add transaction</span>
                </Button>
              }
            />
          ) : (
            <motion.div variants={stagger} initial="hidden" animate="visible">
              <RuledList>
                {initialTransactions.slice(0, 5).map((tx) => {
                  const isExpense = tx.type === "expense";
                  return (
                    <motion.div
                      key={tx.id}
                      variants={fadeUp}
                      className="group flex items-center justify-between gap-4 py-3.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <CategoryMark
                          category={tx.category}
                          direction={isExpense ? "neg" : "pos"}
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm text-ink">
                            {tx.description || tx.category}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-faint">
                            {tx.category} · {tx.date}
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-3">
                        <Money
                          amount={tx.amount}
                          signed
                          direction={isExpense ? "neg" : "pos"}
                          className="text-sm"
                        />

                        {/* focus-within, not hover alone: these stay reachable
                            by keyboard, so hover-only would leave a tabbed-to
                            button invisible while focused. */}
                        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                          <IconButton
                            aria-label="Edit transaction"
                            onClick={() => {
                              setEditData(tx);
                              setIsModalOpen(true);
                            }}
                          >
                            <Edit2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          </IconButton>
                          <IconButton
                            aria-label="Delete transaction"
                            onClick={() => handleDelete(tx)}
                          >
                            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          </IconButton>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </RuledList>
            </motion.div>
          )}
        </Section>

        {/* Budgets Tracker Summary widget */}
        <Section
          label="budgets"
          action={{ href: "/dashboard/budgets", label: "Manage" }}
        >
          {initialBudgets.length === 0 ? (
            <Empty
              title="No limits set"
              description="Set category budgets to track spending against a plan."
            />
          ) : (
            <div className="space-y-5">
              {initialBudgets.slice(0, 4).map((bg) => (
                <Meter
                  key={bg.category}
                  label={bg.category}
                  spent={getCategorySpending(bg.category)}
                  limit={Number(bg.limit_amount)}
                  showStatus
                />
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Gmail connection. The assistant can read email once this is connected,
          and OAuth consent can only happen here — the agent cannot grant it. */}
      <GmailConnection />

      {/* Transaction Modal */}
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
