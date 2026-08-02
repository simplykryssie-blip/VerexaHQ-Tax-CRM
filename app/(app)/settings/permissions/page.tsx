import { requireWorkspace } from "@/lib/auth/workspace";
import { getMyPermissions, requirePermission } from "@/lib/permissions/granular";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function PermissionsPage() {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <ForbiddenState description="Select a workspace to manage permissions." />;
  const access = await requirePermission(workspace.workspace.id, "permissions.manage");
  if (!access.allowed) return <ForbiddenState description={access.reason} />;
  const permissions = await getMyPermissions(workspace.workspace.id);

  return <div className="max-w-5xl space-y-6">
    <PageHeader title="Roles & Permissions" description="Server-enforced permissions for this workspace. Navigation and buttons mirror these decisions; RLS and RPC checks remain authoritative." />
    <Card><CardBody className="p-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border bg-slate-50 text-xs uppercase tracking-wide text-muted"><tr><th className="px-4 py-3">Permission</th><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Effective access</th></tr></thead><tbody className="divide-y divide-border">{Object.values(permissions).map((grant) => <tr key={grant.key}><td className="px-4 py-3 font-medium">{grant.key}</td><td className="px-4 py-3 capitalize text-muted">{grant.scope}</td><td className="px-4 py-3"><StatusBadge label={grant.allowed ? "Allowed" : "Denied"} tone={grant.allowed ? "success" : "neutral"} /></td></tr>)}</tbody></table></div></CardBody></Card>
    <p className="text-xs text-muted">Custom-role editing will be added with the Team section. Owner-only permissions cannot be granted to a custom role.</p>
  </div>;
}
