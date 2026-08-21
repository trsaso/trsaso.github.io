import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Logo } from "@/components/logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your operation" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile) {
    redirect("/today");
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-charcoal px-4 py-10">
      <div className="mb-8 text-white">
        <Logo />
      </div>
      <main className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Set up your operation</CardTitle>
            <CardDescription>
              Step 2 of 2 — name your organization and first site. You&apos;ll
              be its administrator and can add sites, people, and checklists
              later in Settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
