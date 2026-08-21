import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  await getSessionContext();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Reports"
        description="Hazards and defects reported from the field, waiting for triage."
      />
      <ComingSoon
        icon={Megaphone}
        title="Quick Reports & triage queue"
        description="Photo-first hazard reporting with optional voice notes, AI-suggested categorization, and the supervisor triage queue (dismiss, escalate, or convert to a corrective action)."
        phase="Phase 2"
      />
    </div>
  );
}
