import type { Metadata } from "next";
import { Camera } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Quick Report" };

export default async function NewReportPage() {
  await getSessionContext();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Quick Report"
        description="Report a hazard, maintenance issue, or defect in under 90 seconds."
      />
      <ComingSoon
        icon={Camera}
        title="Quick Report capture"
        description="Pick the site and area, take or upload a photo, optionally record a voice note, add a short note, and submit. AI suggestions fill in category, severity, and recommended immediate action when configured."
        phase="Phase 2"
      />
    </div>
  );
}
