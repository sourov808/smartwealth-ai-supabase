"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";
import { modalPop, scrim } from "@/lib/motion";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` styles the action red. Use for anything destructive. */
  tone?: "default" | "danger";
  /** `notice` shows a single dismiss button — for reporting, not asking. */
  mode?: "confirm" | "notice";
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

/**
 * Replaces window.confirm / window.alert.
 *
 * The native dialogs block the main thread, cannot be styled, render as
 * browser chrome that looks nothing like the app, and on mobile are easy to
 * dismiss by accident — a bad set of properties for the last thing standing
 * between a user and deleting their financial records.
 *
 * The promise-based API keeps call sites nearly identical to what they
 * replaced:
 *
 *   if (!(await confirm({ title: "Delete this?" }))) return;
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  // Synced in an effect, not during render: a render-phase ref write is a side
  // effect, and React may render without committing. `settle` only ever runs
  // from an event handler, which is always after the commit, so the ref is
  // current by the time it is read.
  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  const settle = useCallback((ok: boolean) => {
    pendingRef.current?.resolve(ok);
    setPending(null);
  }, []);

  const dialog = (
    <ConfirmDialog
      pending={pending}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirm, dialog };
}

function ConfirmDialog({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: Pending | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Escape must resolve the promise, not just unmount the dialog — an awaiting
  // caller would otherwise hang forever.
  useEffect(() => {
    if (!pending) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    // Focus the action so the dialog is immediately keyboard-operable. For
    // destructive prompts this is the confirm button, which is a deliberate
    // trade: it is reachable in one keystroke, but it is never the default
    // *activated* control — Enter does nothing until the user tabs or clicks.
    confirmRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [pending, onCancel]);

  const isNotice = pending?.mode === "notice";

  return (
    <AnimatePresence>
      {pending && (
        <div
          // z-60 clears the chat drawer at z-50, so a confirm raised from
          // inside the drawer is not trapped behind it.
          className="fixed inset-0 z-60 flex items-center justify-center px-5"
        >
          <motion.div
            variants={scrim}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={onCancel}
            className="absolute inset-0 bg-ink/30"
          />

          <motion.div
            variants={modalPop}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="relative w-full max-w-sm"
          >
            <Surface variant="raised" className="p-6">
              <h2 id="confirm-title" className="display mb-2 text-lg text-ink">
                {pending.title}
              </h2>

              {pending.description && (
                <p className="mb-6 text-sm leading-relaxed text-ink-muted">
                  {pending.description}
                </p>
              )}

              <div className="flex justify-end gap-2">
                {!isNotice && (
                  <Button variant="ghost" size="sm" onClick={onCancel}>
                    {pending.cancelLabel ?? "Cancel"}
                  </Button>
                )}
                <Button
                  ref={confirmRef}
                  variant={pending.tone === "danger" ? "danger" : "primary"}
                  size="sm"
                  onClick={onConfirm}
                >
                  {pending.confirmLabel ?? (isNotice ? "Dismiss" : "Confirm")}
                </Button>
              </div>
            </Surface>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
