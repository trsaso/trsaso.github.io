import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Organization, Profile, UserRole } from "@/lib/database.types";

export interface SessionContext {
  userId: string;
  email: string | null;
  profile: Profile;
  organization: Organization;
}

const ROLE_RANK: Record<UserRole, number> = {
  worker: 0,
  supervisor: 1,
  admin: 2,
};

export function roleAtLeast(role: UserRole, minimum: UserRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/**
 * Loads the signed-in user's profile + organization, deduplicated per request.
 * Redirects to /login when signed out and to /onboarding when the user has no
 * profile yet (fresh account, organization not created).
 */
export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    redirect("/onboarding");
  }

  if (!profile.active) {
    redirect("/account-disabled");
  }

  const { data: organization } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", profile.org_id)
    .single();

  if (!organization) {
    redirect("/onboarding");
  }

  return {
    userId: user.id,
    email: user.email ?? null,
    profile,
    organization,
  };
});

/**
 * Role gate for server pages/layouts. Redirects to /today when the signed-in
 * user's role is below the minimum.
 */
export async function requireRole(minimum: UserRole): Promise<SessionContext> {
  const ctx = await getSessionContext();
  if (!roleAtLeast(ctx.profile.role, minimum)) {
    redirect("/today");
  }
  return ctx;
}
