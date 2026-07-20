"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { NAV_ITEMS } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

/**
 * Navigation list, shared by the desktop rail and the mobile drawer.
 *
 * The active item is marked by a short accent rule to the left of the label
 * rather than a filled pill. A filled block would reintroduce exactly the kind
 * of grey box this design removes everywhere else.
 */
export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 space-y-0.5">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 py-2 pl-4 text-sm transition-colors",
              isActive ? "text-ink" : "text-ink-muted hover:text-ink"
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 transition-all",
                isActive
                  ? "bg-accent opacity-100"
                  : "bg-rule-strong opacity-0 group-hover:opacity-100"
              )}
              aria-hidden
            />
            <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span>{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
