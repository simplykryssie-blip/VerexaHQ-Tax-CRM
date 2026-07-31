import { requireWorkspace } from "@/lib/auth/workspace";
import { listMyClientLinks } from "@/lib/auth/portal";
import { AppShell } from "@/components/app/AppShell";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, workspace, memberships } = await requireWorkspace();

  if (!workspace) {
    const clientLinks = await listMyClientLinks();
    return <NoWorkspaceState hasClientAccess={clientLinks.length > 0} />;
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
