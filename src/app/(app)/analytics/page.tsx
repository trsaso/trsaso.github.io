import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  // Supervisors and admins only; workers are redirected to /today.
  await requireRole("supervisor");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Analytics"
        description="Trends across sites: overdue work, severity mix, hotspots, and closure speed."
      />
      <ComingSoon
        icon={BarChart3}
        title="Analytics dashboard & exports"
        description="Overdue actions, open actions by severity, most common categories, frequent locations, and mean time to close — plus branded PDF reports and the CSV action register."
        phase="Phase 5"
      />
    </div>
  );
}
