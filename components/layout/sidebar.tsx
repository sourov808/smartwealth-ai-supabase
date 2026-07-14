"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "motion/react";
import {
  Coins,
  LayoutDashboard,
  Receipt,
  PieChart,
  Target,
  LogOut,
  Menu,
  X,
  User,
} from "lucide-react";

interface SidebarProps {
  username?: string;
  email?: string;
}

export function Sidebar({ username = "User", email = "" }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Transactions", href: "/dashboard/transactions", icon: Receipt },
    { name: "Budgets", href: "/dashboard/budgets", icon: Target },
    { name: "Analytics", href: "/dashboard/analytics", icon: PieChart },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between h-16 px-4 bg-card border-b border-border sticky top-0 z-30 w-full text-foreground">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center border border-border">
            <Coins className="h-4.5 w-4.5 text-foreground stroke-[1.5]" />
          </div>
          <span className="font-bold text-sm tracking-tight text-foreground">
            Track
          </span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer text-foreground"
        >
          {isOpen ? <X className="h-5 w-5 stroke-[1.5]" /> : <Menu className="h-5 w-5 stroke-[1.5]" />}
        </button>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card text-foreground min-h-screen sticky top-0 p-6 self-start">
        {/* Header Branding */}
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="h-9 w-9 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center border border-border">
            <Coins className="h-5 w-5 text-foreground stroke-[1.5]" />
          </div>
          <span className="font-bold text-base tracking-tight text-foreground">
            Track
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all relative ${
                  isActive
                    ? "text-foreground bg-stone-100 dark:bg-stone-800 font-semibold border border-border shadow-xs"
                    : "text-stone-600 dark:text-stone-400 hover:text-foreground hover:bg-stone-50 dark:hover:bg-stone-800/40"
                }`}
              >
                <item.icon className="h-4 w-4 stroke-[1.5]" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Profile Card & Logout */}
        <div className="mt-auto pt-6 border-t border-border space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="h-8 w-8 rounded-full bg-stone-100 dark:bg-stone-800 border border-border flex items-center justify-center text-stone-500">
              <User className="h-4 w-4 stroke-[1.5]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{username}</p>
              <p className="text-xs text-stone-500 truncate">{email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-rust hover:bg-rust-light dark:hover:bg-rust-light/20 hover:text-rust transition-all cursor-pointer border border-transparent hover:border-rust/20"
          >
            <LogOut className="h-4 w-4 stroke-[1.5]" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Menu Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="md:hidden fixed inset-0 bg-stone-900/40 z-45"
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="md:hidden fixed inset-y-0 left-0 w-64 bg-card border-r border-border z-50 p-6 flex flex-col text-foreground shadow-xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center border border-border">
                    <Coins className="h-4.5 w-4.5 text-foreground stroke-[1.5]" />
                  </div>
                  <span className="font-bold text-sm tracking-tight text-foreground">
                    Track
                  </span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition-colors cursor-pointer text-foreground"
                >
                  <X className="h-5 w-5 stroke-[1.5]" />
                </button>
              </div>

              <nav className="flex-1 space-y-1">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                        isActive
                          ? "text-foreground bg-stone-100 dark:bg-stone-800 font-semibold border border-border shadow-xs"
                          : "text-stone-600 dark:text-stone-400 hover:text-foreground hover:bg-stone-50 dark:hover:bg-stone-800/40"
                      }`}
                    >
                      <item.icon className="h-4 w-4 stroke-[1.5]" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>

              <div className="mt-auto pt-6 border-t border-border space-y-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-stone-100 dark:bg-stone-800 border border-border flex items-center justify-center text-stone-500">
                    <User className="h-4 w-4 stroke-[1.5]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{username}</p>
                    <p className="text-xs text-stone-500 truncate">{email}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-semibold text-rust hover:bg-rust-light dark:hover:bg-rust-light/20 hover:text-rust transition-all cursor-pointer border border-transparent hover:border-rust/20"
                >
                  <LogOut className="h-4 w-4 stroke-[1.5]" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
