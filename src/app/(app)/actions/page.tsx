import type { Metadata } from "next";
import { ListTodo } from "lucide-react";
import { getSessionContext } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { ComingSoon } from "@/components/coming-soon";

export const metadata: Metadata = { title: "Actions" };

export default async function ActionsPage() {
  await getSessionContext();

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Corrective Actions"
        description="Assigned work with owners, priorities, due dates, and closure evidence."
      />
      <ComingSoon
        icon={ListTodo}
        title="Corrective action management"
        description="Open → In progress → Ready for verification → Closed, with before/after photo evidence, completion notes, cost and downtime tracking, and a full audit timeline on every action."
        phase="Phase 3"
      />
    </div>
  );
}
