"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";

import { fadeUp } from "@/lib/motion";

export type ToolActivity = {
  id: string;
  /** Human-readable tool name, already de-underscored. */
  label: string;
  state: "running" | "done";
};

/**
 * The agent's work log for a single reply.
 *
 * Previously a tool call set one shared status string, so each call erased the
 * one before it and the whole trail vanished the moment the first text token
 * arrived. For an agent that may hit several tools before answering, that meant
 * the user saw a spinner, then an answer, with no account of what was actually
 * done — and no way to tell a slow tool from a hung request.
 *
 * The trail persists after the reply lands. What the agent touched to produce
 * an answer is part of the answer, especially when it just moved the user's
 * money around.
 */
export function ToolTrail({ activities }: { activities: ToolActivity[] }) {
  if (activities.length === 0) return null;

  return (
    <ul className="mb-3 space-y-1 border-l border-rule pl-3">
      <AnimatePresence initial={false}>
        {activities.map((activity) => (
          <motion.li
            key={activity.id}
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            className="flex items-center gap-2 text-[11px] text-ink-faint"
          >
            {activity.state === "running" ? (
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" strokeWidth={2} />
            ) : (
              <Check className="h-3 w-3 shrink-0 text-pos" strokeWidth={2} />
            )}
            <span className={activity.state === "running" ? "text-ink-muted" : undefined}>
              {activity.label}
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}
