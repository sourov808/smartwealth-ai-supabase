"use client";

import { useId } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Labelled form controls.
 *
 * Inputs are underlined rather than boxed. A page built from hairlines should
 * not suddenly grow rounded input wells; the rule under the field is the same
 * rule that separates the sections around it.
 */

const CONTROL = cn(
  "w-full bg-transparent py-2 text-sm text-ink placeholder:text-ink-faint",
  "border-b border-rule transition-colors",
  "hover:border-rule-strong focus:border-accent focus:outline-none",
  "disabled:cursor-not-allowed disabled:opacity-50"
);

/**
 * `className` on these components lands on the control itself, which is what
 * callers want for things like `[appearance:textfield]`. But it means layout
 * classes — flex sizing, column spans — have nowhere to go, since the control
 * is two elements deep. `wrapperClassName` is that escape hatch, so callers do
 * not have to wrap every field in a sizing div.
 */
function Shell({
  id,
  label,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="eyebrow block">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}

export function Field({
  label,
  hint,
  icon: Icon,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  const id = useId();

  return (
    <Shell id={id} label={label} hint={hint}>
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            strokeWidth={1.5}
          />
        )}
        <input id={id} className={cn(CONTROL, Icon && "pl-6", className)} {...props} />
      </div>
    </Shell>
  );
}

export function SelectField({
  label,
  hint,
  icon: Icon,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  icon?: LucideIcon;
}) {
  const id = useId();

  return (
    <Shell id={id} label={label} hint={hint}>
      <div className="relative">
        {Icon && (
          <Icon
            className="pointer-events-none absolute left-0 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
            strokeWidth={1.5}
          />
        )}
        <select
          id={id}
          className={cn(CONTROL, "cursor-pointer appearance-none pr-6", Icon && "pl-6", className)}
          {...props}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-ink-faint">
          ▾
        </span>
      </div>
    </Shell>
  );
}

export function TextareaField({
  label,
  hint,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
}) {
  const id = useId();

  return (
    <Shell id={id} label={label} hint={hint}>
      <textarea id={id} className={cn(CONTROL, "resize-none", className)} {...props} />
    </Shell>
  );
}
