import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signOutAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Account disabled" };

export default function AccountDisabledPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-charcoal px-4 py-10">
      <div className="mb-8 text-white">
        <Logo />
      </div>
      <main className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldAlert className="h-5 w-5 text-hazard" aria-hidden="true" />
              Account disabled
            </CardTitle>
            <CardDescription>
              Your account has been deactivated by an administrator of your
              organization. If you believe this is a mistake, contact your site
              admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" className="w-full">
                Sign out
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
