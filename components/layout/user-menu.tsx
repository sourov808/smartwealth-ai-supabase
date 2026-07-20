"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { createClient } from "@/lib/supabase/client";

/**
 * Account footer: identity, theme control, sign out.
 *
 * Extracted because the rail and the drawer both need it, and the logout call
 * was previously written out in both places.
 */
export function UserMenu({
  username = "User",
  email = "",
}: {
  username?: string;
  email?: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mt-auto space-y-3 border-t border-rule pt-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm text-ink">{username}</p>
          {email && <p className="truncate text-xs text-ink-faint">{email}</p>}
        </div>
        <ThemeToggle className="shrink-0" />
      </div>

      <button
        onClick={handleLogout}
        className="flex w-full cursor-pointer items-center gap-2 py-1 text-xs text-ink-faint transition-colors hover:text-accent"
      >
        <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
        <span>Sign out</span>
      </button>
    </div>
  );
}
