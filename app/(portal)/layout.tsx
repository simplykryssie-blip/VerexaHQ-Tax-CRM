import { requirePortalAccess } from "@/lib/auth/portal";
import { listMyWorkspaces } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceName } from "@/lib/data/portal";
import { PortalShell } from "@/components/portal/PortalShell";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, client, links } = await requirePortalAccess();

  if (!client) {
    const memberships = await listMyWorkspaces();
    return <PortalNotLinkedState hasStaffAccess={memberships.length > 0} />;
  }

  const supabase = await createClient();
  const workspaceName = await getWorkspaceName(supabase, client.client.workspace_id);

  return (
    <PortalShell
      client={client}
      links={links}
      userEmail={user.email ?? "—"}
      workspaceName={workspaceName}
    >
      {children}
    </PortalShell>
  );
}
