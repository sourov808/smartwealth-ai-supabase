"use client";

import { AlertTriangle, CheckCircle2, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";

export interface ConfirmTransaction {
  id: string;
  amount: number;
  type: string;
  category: string;
  description: string | null;
  date: string;
}

/**
 * The tool-confirmation card for a destructive agent action.
 *
 * The approve/cancel handlers live in `chat-assistant.tsx` (they touch Supabase
 * and re-enter the chat transport); this component only calls them with the
 * exact same arguments the inline version did.
 */
export function ConfirmCard({
  transaction,
  confirmState,
  onApprove,
  onCancel,
}: {
  transaction: ConfirmTransaction;
  confirmState?: "pending" | "approved" | "cancelled";
  onApprove: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 w-full space-y-3 border-l-2 border-warn bg-warn-soft py-3 pr-3 pl-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" strokeWidth={1.5} />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-ink">Approve Transaction Deletion</p>
          <p className="text-xs text-ink-muted">
            This action will permanently remove the record from your account.
          </p>
        </div>
      </div>

      {/* Transaction Ledger Item */}
      <div className="flex items-center justify-between gap-3 border-t border-rule pt-2.5 text-xs">
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">
            {transaction.description || transaction.category}
          </p>
          <p className="mt-0.5 text-xs text-ink-faint">
            {transaction.date} • {transaction.category}
          </p>
        </div>
        <Money
          amount={transaction.amount}
          signed
          direction={transaction.type === "expense" ? "neg" : "pos"}
          className="shrink-0 text-xs"
        />
      </div>

      {/* Action buttons based on confirmation state */}
      {confirmState === "pending" && (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="primary" onClick={onApprove} className="flex-1">
            <Trash2 className="h-3 w-3" strokeWidth={2} />
            <span>Approve Delete</span>
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} className="flex-1">
            <span>Cancel</span>
          </Button>
        </div>
      )}

      {confirmState === "approved" && (
        <div className="flex items-center gap-1 py-1 text-xs font-medium text-pos">
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>Deletion Approved &amp; Completed</span>
        </div>
      )}

      {confirmState === "cancelled" && (
        <div className="flex items-center gap-1 py-1 text-xs font-medium text-ink-faint">
          <X className="h-3.5 w-3.5" />
          <span>Deletion Cancelled</span>
        </div>
      )}
    </div>
  );
}
