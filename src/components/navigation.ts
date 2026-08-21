import {
  BarChart3,
  ClipboardCheck,
  Home,
  ListTodo,
  Megaphone,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/database.types";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Minimum role required to see this destination. */
  minRole: UserRole;
  /** Whether the item appears in the mobile bottom tab bar. */
  mobileTab: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: Home, minRole: "worker", mobileTab: true },
  { href: "/reports", label: "Reports", icon: Megaphone, minRole: "worker", mobileTab: true },
  { href: "/actions", label: "Actions", icon: ListTodo, minRole: "worker", mobileTab: true },
  {
    href: "/inspections",
    label: "Inspections",
    icon: ClipboardCheck,
    minRole: "worker",
    mobileTab: true,
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    minRole: "supervisor",
    mobileTab: false,
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    minRole: "admin",
    mobileTab: false,
  },
];

const ROLE_RANK: Record<UserRole, number> = {
  worker: 0,
  supervisor: 1,
  admin: 2,
};

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => ROLE_RANK[role] >= ROLE_RANK[item.minRole]);
}

export const ROLE_LABELS: Record<UserRole, string> = {
  worker: "Worker",
  supervisor: "Supervisor",
  admin: "Admin",
};
