"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X } from "lucide-react";

import { NavLinks } from "@/components/layout/nav-link";
import { UserMenu } from "@/components/layout/user-menu";
import { Wordmark } from "@/components/layout/wordmark";
import { drawerSpring, scrim } from "@/lib/motion";

export function MobileNav({
  username,
  email,
}: {
  username?: string;
  email?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close on navigation. Without this the drawer stays open over the page the
  // user just asked for.
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // The drawer is a modal surface; the page behind it must not scroll.
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-rule bg-paper px-5 md:hidden">
        <Wordmark className="text-lg" />
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Open navigation"
          className="cursor-pointer p-1 text-ink-muted transition-colors hover:text-ink"
        >
          <Menu className="h-5 w-5" strokeWidth={1.5} />
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              variants={scrim}
              initial="hidden"
              animate="visible"
              exit="hidden"
              onClick={() => setIsOpen(false)}
              // Flat scrim, no blur — the design uses no glass effects.
              className="fixed inset-0 z-40 bg-ink/25 md:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={drawerSpring}
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-rule bg-paper p-6 md:hidden"
            >
              <div className="mb-8 flex items-center justify-between">
                <Wordmark />
                <button
                  onClick={() => setIsOpen(false)}
                  aria-label="Close navigation"
                  className="cursor-pointer p-1 text-ink-muted transition-colors hover:text-ink"
                >
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>

              <NavLinks onNavigate={() => setIsOpen(false)} />
              <UserMenu username={username} email={email} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
