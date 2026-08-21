import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Enter your full name (at least 2 characters)")
      .max(120, "Name is too long"),
    email: z
      .string()
      .min(1, "Email is required")
      .email("Enter a valid email address"),
    password: z
      .string()
      .min(10, "Use at least 10 characters")
      .max(72, "Password is too long"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const onboardingSchema = z.object({
  orgName: z
    .string()
    .trim()
    .min(2, "Enter your company or operation name")
    .max(120, "Name is too long"),
  siteName: z
    .string()
    .trim()
    .min(2, "Enter your first site name, e.g. “Sivec Quarry”")
    .max(120, "Site name is too long"),
  siteCode: z
    .string()
    .trim()
    .min(1, "Enter a short site code, e.g. “SIVEC”")
    .max(16, "Keep the code under 16 characters")
    .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and dashes only"),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;

/** Builds a URL-safe slug from an organization name, e.g. for onboarding. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
