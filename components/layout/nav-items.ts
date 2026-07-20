import {
  LayoutDashboard,
  PieChart,
  Receipt,
  Target,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

/**
 * The single source of truth for navigation.
 *
 * This list was previously duplicated between the desktop rail and the mobile
 * drawer in the same file, so adding a route meant remembering to add it twice.
 */
export const NAV_ITEMS: NavItem[] = [
  { name: "overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "transactions", href: "/dashboard/transactions", icon: Receipt },
  { name: "budgets", href: "/dashboard/budgets", icon: Target },
  { name: "analytics", href: "/dashboard/analytics", icon: PieChart },
];
