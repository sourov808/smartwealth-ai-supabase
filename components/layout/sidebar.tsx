"use client";

import { MobileNav } from "@/components/layout/mobile-nav";
import { NavLinks } from "@/components/layout/nav-link";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/layout/wordmark";

interface SidebarProps {
  username?: string;
  email?: string;
}

/**
 * The desktop rail, plus the mobile bar and drawer.
 *
 * This file used to hold all three surfaces and duplicate the nav list, the
 * profile block, and the logout handler between them. Each of those now lives
 * in exactly one place; this component only composes them.
 *
 * The rail has no border and no background fill — it sits on the same paper as
 * the content, separated by whitespace alone.
 */
export function Sidebar({ username, email }: SidebarProps) {
  return (
    <>
      <MobileNav username={username} email={email} />

      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col self-start px-6 py-8 md:flex">
        <div className="mb-12">
          <Wordmark />
        </div>

        <NavLinks />
        <UserMenu username={username} email={email} />
      </aside>
    </>
  );
}
