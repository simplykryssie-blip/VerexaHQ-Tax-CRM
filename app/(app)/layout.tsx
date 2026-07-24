import { requireWorkspace } from "@/lib/auth/workspace";
import { AppShell } from "@/components/app/AppShell";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, workspace, memberships } = await requireWorkspace();

  if (!workspace) {
    return <NoWorkspaceState />;
  }

  return (
    <AppShell
      workspace={workspace}
      memberships={memberships}
      userEmail={user.email ?? "—"}
    >
      {children}
    </AppShell>
  );
}
