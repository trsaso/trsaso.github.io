import type { Metadata } from "next";
import { ClipboardCheck } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Inspections" };

export default async function InspectionsPage() {
  await getSessionContext();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Inspections"
        description="Daily checklist runs for benches, haul roads, plant, and equipment."
      />
      <ComingSoon
        icon={ClipboardCheck}
        title="Daily inspection checklists"
        description="Run start-of-shift walkarounds from your operation's templates: pass/fail/N.A. per item, photos on failed items, and automatic follow-up reports for anything that fails."
        phase="Phase 4"
      />
    </div>
  );
}
