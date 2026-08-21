import { AppShell } from "@/components/app-shell";
import { getSessionContext } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, organization, email } = await getSessionContext();

  return (
    <AppShell
      fullName={profile.full_name}
      email={email}
      role={profile.role}
      orgName={organization.name}
    >
      {children}
    </AppShell>
  );
}
