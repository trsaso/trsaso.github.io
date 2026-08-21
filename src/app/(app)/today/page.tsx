import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  AlertTriangle,
  Camera,
  ClipboardCheck,
  Inbox,
  ListTodo,
  UserCheck,
} from "lucide-react";

import { getSessionContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { roleAtLeast } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "./stat-card";

export const metadata: Metadata = { title: "Today" };

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

async function TodayStats() {
  const { profile } = await getSessionContext();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const supervisor = roleAtLeast(profile.role, "supervisor");

  // Live counts scoped by RLS to the user's organization.
  const [triage, openActions, overdue, mine] = await Promise.all([
    supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("status", "triage"),
    supabase
      .from("actions")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress", "ready_for_verification"]),
    supabase
      .from("actions")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_progress"])
      .lt("due_date", today),
    supabase
      .from("actions")
      .select("id", { count: "exact", head: true })
      .eq("assignee_id", profile.id)
      .in("status", ["open", "in_progress"]),
  ]);

  const firstError =
    triage.error ?? openActions.error ?? overdue.error ?? mine.error;
  if (firstError) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-6 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-hazard" aria-hidden="true" />
          <span>
            Couldn&apos;t load today&apos;s numbers. Check your connection and
            reload the page.
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Reports in triage"
        value={triage.count ?? 0}
        icon={Inbox}
        href={supervisor ? "/reports" : undefined}
        tone={supervisor && (triage.count ?? 0) > 0 ? "amber" : "neutral"}
        srHint={supervisor ? "Review the triage queue" : undefined}
      />
      <StatCard
        label="Open actions"
        value={openActions.count ?? 0}
        icon={ListTodo}
        href="/actions"
      />
      <StatCard
        label="Overdue actions"
        value={overdue.count ?? 0}
        icon={AlertTriangle}
        href="/actions"
        tone={(overdue.count ?? 0) > 0 ? "hazard" : "success"}
        srHint={
          (overdue.count ?? 0) > 0
            ? "Past their due date — needs attention"
            : "Nothing overdue"
        }
      />
      <StatCard
        label="Assigned to me"
        value={mine.count ?? 0}
        icon={UserCheck}
        href="/actions"
      />
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="space-y-3 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-14" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default async function TodayPage() {
  const { profile, organization } = await getSessionContext();
  const hour = new Date().getHours();
  const firstName = profile.full_name.split(/\s+/)[0] ?? profile.full_name;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6">
        <p className="text-sm text-muted-foreground">{organization.name}</p>
        <h1 className="text-2xl font-bold tracking-tight">
          {greetingForHour(hour)}, {firstName}
        </h1>
      </div>

      {/* Primary field actions — large targets for gloved hands */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <Button asChild variant="accent" size="lg" className="h-auto justify-start px-5 py-4">
          <Link href="/reports/new">
            <Camera className="!size-6" aria-hidden="true" />
            <span className="flex flex-col items-start">
              <span className="text-base font-bold">Quick Report</span>
              <span className="text-xs font-medium opacity-80">
                Photo a hazard or defect — under 90 seconds
              </span>
            </span>
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-auto justify-start px-5 py-4">
          <Link href="/inspections">
            <ClipboardCheck className="!size-6" aria-hidden="true" />
            <span className="flex flex-col items-start">
              <span className="text-base font-bold">Start Inspection</span>
              <span className="text-xs font-medium text-muted-foreground">
                Run a start-of-shift checklist
              </span>
            </span>
          </Link>
        </Button>
      </div>

      <section aria-label="Today's numbers">
        <Suspense fallback={<StatsSkeleton />}>
          <TodayStats />
        </Suspense>
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Getting started</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            This is your operation&apos;s live overview. Quick Report capture,
            the triage queue, corrective actions, and inspections come online in
            the next build phases — the numbers above are live from your
            database already.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
