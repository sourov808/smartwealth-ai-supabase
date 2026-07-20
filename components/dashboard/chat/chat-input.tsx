"use client";

import { useEffect, useRef } from "react";
import { Send } from "lucide-react";

import { IconButton } from "@/components/ui/button";

const MAX_ROWS = 6;

/**
 * The chat composer.
 *
 * This was a single-line <input>, which meant any message longer than the
 * drawer's width scrolled sideways: the text ran out past the underline and the
 * user could not see what they had typed. A textarea wraps instead, and grows
 * with the content up to a cap before scrolling internally.
 *
 * Enter sends, Shift+Enter inserts a newline — the convention for chat
 * composers. Without the Shift affordance a multi-line box is a trap, because
 * the obvious way to start a new line submits the message instead.
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow to fit content. Height must be reset to "auto" first or scrollHeight
  // reports the previous, larger box and the field can only ever grow.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    el.style.height = "auto";

    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const maxHeight = lineHeight * MAX_ROWS;

    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [value]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;

    // IME composition: Enter is committing a candidate word, not sending.
    // Submitting here would cut off users typing in Japanese, Chinese, or Korean
    // mid-word.
    if (event.nativeEvent.isComposing) return;

    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex items-end gap-2"
    >
      <textarea
        ref={ref}
        rows={1}
        disabled={disabled}
        placeholder="Ask about budgets or ledger…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 resize-none border-b border-rule bg-transparent py-2 text-sm leading-5 text-ink outline-none transition-colors placeholder:text-ink-faint hover:border-rule-strong focus:border-accent disabled:cursor-not-allowed disabled:opacity-50"
      />
      <IconButton
        type="submit"
        variant="primary"
        disabled={disabled || !value.trim()}
        aria-label="Send message"
      >
        <Send className="h-3.5 w-3.5" strokeWidth={2} />
      </IconButton>
    </form>
  );
}
