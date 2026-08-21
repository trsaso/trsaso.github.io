import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Sign in</CardTitle>
        <CardDescription>
          Use your work email to access your operation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {params.error === "confirmation_failed" && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden="true" />
            <AlertTitle>Confirmation link problem</AlertTitle>
            <AlertDescription>
              That confirmation link is invalid or has expired. Try signing in —
              if that fails, register again to get a fresh link.
            </AlertDescription>
          </Alert>
        )}
        <LoginForm next={params.next} />
        <p className="text-center text-sm text-muted-foreground">
          Setting up a new operation?{" "}
          <Link
            href="/register"
            className="font-semibold text-foreground underline underline-offset-4"
          >
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
