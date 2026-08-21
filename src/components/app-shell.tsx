"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import {
  navItemsForRole,
  ROLE_LABELS,
  type NavItem,
} from "@/components/navigation";
import type { UserRole } from "@/lib/database.types";

interface AppShellProps {
  fullName: string;
  email: string | null;
  role: UserRole;
  orgName: string;
  children: React.ReactNode;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-touch items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors",
        active
          ? "bg-amber text-amber-foreground"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      {item.label}
    </Link>
  );
}

function MobileTab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-touch flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-semibold transition-colors",
        active ? "text-amber" : "text-white/70 hover:text-white"
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span>{item.label}</span>
      <span
        aria-hidden="true"
        className={cn(
          "h-1 w-8 rounded-full",
          active ? "bg-amber" : "bg-transparent"
        )}
      />
    </Link>
  );
}

export function AppShell({
  fullName,
  email,
  role,
  orgName,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const items = navItemsForRole(role);
  const mobileTabs = items.filter((item) => item.mobileTab).slice(0, 5);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-charcoal md:flex"
        aria-label="Primary"
      >
        <div className="flex items-center px-4 py-5 text-white">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 px-3 py-2" aria-label="Main navigation">
          {items.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
            />
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-4">
          <p className="truncate text-sm font-semibold text-white">{fullName}</p>
          <p className="truncate text-xs text-white/60">
            {ROLE_LABELS[role]} · {orgName}
          </p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-card px-4 py-2 md:justify-end">
          <span className="md:hidden">
            <Logo />
          </span>
          <UserMenu
            fullName={fullName}
            email={email}
            role={role}
            orgName={orgName}
          />
        </header>
        <main className="flex-1 px-4 pb-24 pt-4 sm:px-6 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/10 bg-charcoal pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="Main navigation"
      >
        {mobileTabs.map((item) => (
          <MobileTab
            key={item.href}
            item={item}
            active={isActive(pathname, item.href)}
          />
        ))}
      </nav>
    </div>
  );
}
