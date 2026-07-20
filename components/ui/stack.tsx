import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A titled section: eyebrow label, optional action link, hairline, content.
 *
 * This is the structural unit of the whole design. Every page is a stack of
 * these, separated by rules rather than card boundaries.
 */
export function Section({
  label,
  action,
  className,
  children,
}: {
  label: string;
  action?: { href: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
        <h2 className="eyebrow">{label}</h2>
        {action && (
          <Link
            href={action.href}
            className="group flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-accent"
          >
            <span>{action.label}</span>
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/**
 * Page masthead: serif title, optional supporting line, optional action slot.
 */
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-rule pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h1 className="display text-3xl text-ink">{title}</h1>
        {description && <p className="text-sm text-ink-muted">{description}</p>}
      </div>
      {children}
    </header>
  );
}

/** Rows separated by hairlines. Replaces the bordered list cards. */
export function RuledList({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("divide-y divide-rule", className)}>{children}</div>;
}
