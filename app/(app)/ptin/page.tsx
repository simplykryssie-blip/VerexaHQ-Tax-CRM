import Link from "next/link";
import { BriefcaseBusiness, ClipboardCheck, FileClock, ListChecks } from "lucide-react";
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
import { engagementStatusLabel } from "@/lib/status";

type EngagementRow = {
  id: string;
  title: string;
  tax_year: number | null;
  status: string;
  due_date: string | null;
  client: { first_name: string; last_name: string; company: string | null } | null;
};

export default async function PtinDashboardPage() {
  const { user, workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const supabase = await createClient();
  const workspaceId = workspace.workspace.id;
  const assignedOnly = !["owner", "admin"].includes(workspace.role);

  let clientsQuery = supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .is("archived_at", null);
  let tasksQuery = supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .not("status", "in", '("completed","cancelled")');
  let documentRequestsQuery = supabase
    .from("document_requests")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .not("status", "in", '("completed","cancelled","expired")');
  let engagementsQuery = supabase
    .from("tax_engagements")
    .select("id,title,tax_year,status,due_date,client:clients(first_name,last_name,company)")
    .eq("workspace_id", workspaceId)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(8);

  if (assignedOnly) {
    clientsQuery = clientsQuery.or(`assigned_user_id.eq.${user.id},owner_user_id.eq.${user.id}`);
    tasksQuery = tasksQuery.eq("assigned_to_user_id", user.id);
    documentRequestsQuery = documentRequestsQuery.eq("assigned_to_user_id", user.id);
    engagementsQuery = engagementsQuery.eq("primary_preparer_user_id", user.id);
  }

  const [clients, tasks, documentRequests, engagements, readyForEro] = await Promise.all([
    clientsQuery,
    tasksQuery,
    documentRequestsQuery,
    engagementsQuery,
    supabase
      .from("tax_engagements")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "ready_for_ero")
      .eq(assignedOnly ? "primary_preparer_user_id" : "workspace_id", assignedOnly ? user.id : workspaceId),
  ]);

  const recent = (engagements.data ?? []) as unknown as EngagementRow[];

  return (
    <div className="space-y-6">
      <RoleDashboardHero
        eyebrow="PTIN holder workspace"
        title="Your client work and tax-season handoffs"
        description="Manage assigned clients, intake, documents, and engagement progress before handing completed work to the ERO. Verexa tracks the workflow; it does not prepare or transmit returns."
        actions={[
          { href: "/clients/new", label: "Add client" },
          { href: "/engagements/new", label: "New engagement" },
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RoleMetric icon={BriefcaseBusiness} label="My clients" value={clients.count ?? 0} helper="Clients in your current work view" />
        <RoleMetric icon={ListChecks} label="Open tasks" value={tasks.count ?? 0} helper="Assignments still requiring action" />
        <RoleMetric icon={FileClock} label="Document requests" value={documentRequests.count ?? 0} helper="Open or incomplete requests" />
        <RoleMetric icon={ClipboardCheck} label="Ready for ERO" value={readyForEro.count ?? 0} helper="Engagements ready for handoff" />
      </section>

      <DashboardSection title="Recent engagements" href="/engagements?mine=1">
        {recent.length === 0 ? (
          <DashboardEmpty>No engagements are assigned yet.</DashboardEmpty>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((engagement) => {
              const clientName = engagement.client?.company ||
                `${engagement.client?.first_name ?? ""} ${engagement.client?.last_name ?? ""}`.trim() ||
                "Client";
              return (
                <Link
                  key={engagement.id}
                  href={`/engagements/${engagement.id}`}
                  className="flex items-center justify-between gap-4 py-3.5 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{clientName}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {engagement.tax_year ?? "No tax year"} · {engagement.title}
                    </div>
                  </div>
                  <Badge variant="secondary">{engagementStatusLabel(engagement.status)}</Badge>
                </Link>
              );
            })}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
