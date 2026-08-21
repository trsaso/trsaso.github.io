"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  loginSchema,
  registerSchema,
  onboardingSchema,
  slugify,
  type LoginInput,
  type RegisterInput,
  type OnboardingInput,
} from "@/lib/validation/auth";

export interface AuthActionResult {
  error?: string;
  needsEmailConfirmation?: boolean;
}

export async function loginAction(
  input: LoginInput,
  next?: string
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Check your email and password and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    if (error.code === "invalid_credentials") {
      return { error: "Wrong email or password. Check both and try again." };
    }
    if (error.code === "email_not_confirmed") {
      return {
        error:
          "This email hasn't been confirmed yet. Open the confirmation link we sent you, then sign in.",
      };
    }
    return { error: error.message };
  }

  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/today";
  redirect(safeNext);
}

export async function registerAction(
  input: RegisterInput
): Promise<AuthActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Fix the highlighted fields and try again." };
  }

  const supabase = await createClient();
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback?next=/onboarding`,
      data: { full_name: parsed.data.fullName },
    },
  });

  if (error) {
    if (error.code === "user_already_exists") {
      return {
        error: "An account with this email already exists. Sign in instead.",
      };
    }
    if (error.code === "weak_password") {
      return { error: "That password is too weak. Use a longer passphrase." };
    }
    return { error: error.message };
  }

  // With email confirmation enabled Supabase returns a user but no session.
  if (!data.session) {
    return { needsEmailConfirmation: true };
  }

  redirect("/onboarding");
}

export async function onboardAction(
  input: OnboardingInput
): Promise<AuthActionResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Fix the highlighted fields and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const baseSlug = slugify(parsed.data.orgName) || "organization";
  // Salt the slug for uniqueness without leaking anything meaningful.
  const slug = `${baseSlug}-${user.id.slice(0, 6)}`;

  const fullName =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Site Admin";

  const { error } = await supabase.rpc("onboard_organization", {
    p_org_name: parsed.data.orgName,
    p_org_slug: slug,
    p_full_name: fullName,
    p_site_name: parsed.data.siteName,
    p_site_code: parsed.data.siteCode.toUpperCase(),
  });

  if (error) {
    if (error.message.includes("already belongs")) {
      redirect("/today");
    }
    return {
      error:
        "Could not create the organization. Try again — if it keeps failing, contact support.",
    };
  }

  redirect("/today");
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
