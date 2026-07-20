"use client";

import { motion } from "motion/react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "danger" | "quiet";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-ink text-paper hover:bg-ink/90 disabled:hover:bg-ink",
  /** Bordered, transparent. The default for secondary actions. */
  ghost:
    "border border-rule text-ink hover:border-rule-strong hover:bg-paper-sunken",
  danger:
    "border border-neg/30 text-neg hover:bg-neg-soft hover:border-neg/50",
  /** No chrome until hovered. For icon actions inside rows. */
  quiet:
    "text-ink-faint hover:text-ink hover:bg-paper-sunken",
};

const SIZES: Record<Size, string> = {
  sm: "text-xs px-2.5 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2.5 gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  /** React 19 passes ref as a plain prop; declaring it keeps that typed. */
  ref?: React.Ref<HTMLButtonElement>;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-md font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      // motion's own drag/animation props collide with React's on some events;
      // this component only ever needs the standard button surface.
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}

/**
 * An anchor that looks like a Button.
 *
 * Needed because navigation must stay an anchor. Faking it with a button and
 * `window.location.href` looks identical but silently breaks middle-click,
 * open-in-new-tab, and "copy link address" — and hides the destination from
 * assistive tech, which announces a link and a button differently.
 *
 * Plain <a>, not next/link: the callers so far are external OAuth handshakes
 * that need a real document navigation, not a client-side transition.
 */
export function ButtonLink({
  variant = "ghost",
  size = "md",
  className,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <a
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-md font-medium transition-colors",
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {children}
    </a>
  );
}

/** Square icon-only button, sized to sit inside a table or list row. */
export function IconButton({
  variant = "quiet",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      className={cn(
        "inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        className
      )}
      {...(props as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  );
}
