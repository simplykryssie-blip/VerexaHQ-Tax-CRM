import Link from "next/link";
import { Building2, ClipboardCheck, FileBarChart, Network, Users } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  DashboardEmpty,
  DashboardSection,
  RoleDashboardHero,
  RoleMetric,
} from "@/components/dashboard/RoleDashboard";
import { Badge } from "@/components/ui/badge";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";
import { relationshipStatusLabel, relationshipTypeLabel } from "@/lib/validation/relationships";

type RelationshipRow = {
  id: string;
  status: "pending" | "active" | "paused" | "ended" | "declined";
  relationship_type: "service_bureau_to_ero" | "ero_to_preparer" | "ptin_to_ero";
  source_workspace_id: string;
  target_workspace_id: string;
  source: { name: string } | null;
  target: { name: string } | null;
};

export default async function ServiceBureauDashboardPage() {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const supabase = await createClient();
  const workspaceId = workspace.workspace.id;

  const [relationships, production, pendingReview, members] = await Promise.all([
    supabase
      .from("workspace_relationships")
      .select("id,status,relationship_type,source_workspace_id,target_workspace_id,source:workspaces!workspace_relationships_source_workspace_id_fkey(name),target:workspaces!workspace_relationships_target_workspace_id_fkey(name)")
      .or(`source_workspace_id.eq.${workspaceId},target_workspace_id.eq.${workspaceId}`)
      .order("created_at", { ascending: false }),
    supabase.from("tax_engagements").select("id", { count: "exact", head: true }).eq("service_bureau_workspace_id", workspaceId),
    supabase.from("tax_engagements").select("id", { count: "exact", head: true }).eq("service_bureau_workspace_id", workspaceId).in("status", ["internal_review", "reviewer_review", "ready_for_ero"]),
    supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "active"),
  ]);

  const connections = (relationships.data ?? []) as unknown as RelationshipRow[];
  const activeOffices = connections.filter((relationship) => relationship.status === "active").length;

  return (
    <div className="space-y-6">
      <RoleDashboardHero
        eyebrow="Service Bureau workspace"
        title="Your network command center"
        description="Monitor connected-office production, ERO review pressure, training, and support without automatically exposing private taxpayer records."
        actions={[
          { href: "/relationships", label: "Manage connections" },
          { href: "/reports", label: "Production reports" },
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RoleMetric icon={Building2} label="Connected offices" value={activeOffices} helper="Active network relationships" />
        <RoleMetric icon={Users} label="Internal team" value={members.count ?? 0} helper="Service Bureau workspace members" />
        <RoleMetric icon={FileBarChart} label="Tracked engagements" value={production.count ?? 0} helper="Network production linked to this bureau" />
        <RoleMetric icon={ClipboardCheck} label="Review pressure" value={pendingReview.count ?? 0} helper="Engagements in review stages" />
      </section>

      <DashboardSection title="Network connections" href="/relationships">
        {connections.length === 0 ? (
          <DashboardEmpty>No ERO or PTIN workspaces are connected yet.</DashboardEmpty>
        ) : (
          <div className="divide-y divide-border">
            {connections.slice(0, 8).map((relationship) => {
              const partner = relationship.source_workspace_id === workspaceId ? relationship.target : relationship.source;
              return (
                <Link
                  key={relationship.id}
                  href="/relationships"
                  className="flex items-center justify-between gap-4 py-3.5 hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Network className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{partner?.name ?? "Connected workspace"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{relationshipTypeLabel(relationship.relationship_type)}</div>
                    </div>
                  </div>
                  <Badge variant={relationship.status === "active" ? "success" : "secondary"}>
                    {relationshipStatusLabel(relationship.status)}
                  </Badge>
                </Link>
              );
            })}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
