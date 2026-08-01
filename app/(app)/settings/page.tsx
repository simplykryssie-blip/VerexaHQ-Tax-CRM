import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { getUserSummaryMap } from "@/lib/data/users";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { membershipRoleLabels, membershipStatusMeta } from "@/lib/status";
import { formatDate, titleCase } from "@/lib/utils";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function SettingsPage() {
  const { workspace, memberships } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", workspace.workspace.id)
    .order("created_at", { ascending: true });

  const userMap = await getUserSummaryMap(supabase, (members ?? []).map((m) => m.user_id));

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Settings" description="Workspace details and team." />

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Workspace</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Name</dt>
              <dd className="mt-1 text-sm text-foreground">{workspace.workspace.name}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Type</dt>
              <dd className="mt-1 text-sm text-foreground">{titleCase(workspace.workspace.workspace_type)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Status</dt>
              <dd className="mt-1 text-sm text-foreground">{titleCase(workspace.workspace.status)}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Your role</dt>
              <dd className="mt-1 text-sm text-foreground">{membershipRoleLabels[workspace.role] ?? workspace.role}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Workspaces you belong to</dt>
              <dd className="mt-1 text-sm text-foreground">{memberships.length}</dd>
            </div>
          </dl>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Organizer templates</h2>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              Manage the tax organizer templates clients and staff use across engagements.
            </p>
            <Link
              href="/settings/organizers"
              className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-accent-700 hover:underline"
            >
              Manage templates <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Team members</h2>
        </CardHeader>
        <CardBody className="p-0">
          <ul className="divide-y divide-border">
            {(members ?? []).map((member) => {
              const status = membershipStatusMeta(member.status);
              return (
                <li key={member.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {userMap.get(member.user_id)?.name ?? "Staff member"}
                    </p>
                    <p className="text-xs text-muted">
                      {membershipRoleLabels[member.role] ?? titleCase(member.role)}
                      {member.title ? ` · ${member.title}` : ""} · Joined {formatDate(member.joined_at)}
                    </p>
                  </div>
                  <StatusBadge label={status.label} tone={status.tone} />
                </li>
              );
            })}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
}
