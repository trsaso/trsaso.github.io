import type { Metadata } from "next";
import { Settings } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  // Admins only; everyone else is redirected to /today.
  await requireRole("admin");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Settings"
        description="Manage your organization's sites, people, categories, and checklist templates."
      />
      <ComingSoon
        icon={Settings}
        title="Organization settings"
        description="Invite and manage users and roles, add sites and areas, maintain hazard categories, and build inspection checklist templates."
        phase="Phase 6"
      />
    </div>
  );
}
