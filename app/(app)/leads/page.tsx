import Link from "next/link";
import { UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { LeadFormDialog } from "@/features/leads/lead-form-dialog";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/validation/leads";
import { formatDate } from "@/lib/formatters";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { LeadStageSelect } from "@/features/leads/lead-stage-select";
import { getLeadCatalogOptions } from "@/features/leads/queries";
import type { PickerOption } from "@/features/engagements/client-picker";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; status?: string }>;
}) {
  const { view = "table", status } = await searchParams;
  const { workspace } = await requireWorkspace();
  if (!workspace) return <ForbiddenState />;
  const [viewAccess, createAccess, editAccess] = await Promise.all([
    requirePermission(workspace.workspace.id, "leads.view"),
    requirePermission(workspace.workspace.id, "leads.create"),
    requirePermission(workspace.workspace.id, "leads.edit"),
  ]);
  if (!viewAccess.allowed) return <ForbiddenState description={viewAccess.reason} />;
  const supabase = await createClient();
  const workspaceId = workspace.workspace.id;

  let query = supabase
    .from("leads")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (status) query = query.eq("status", status as (typeof LEAD_STATUSES)[number]);

  const { data: leads, error } = await query;

  const [{ leadSources, serviceOfferings }, { data: staffMembers }] = await Promise.all([
    getLeadCatalogOptions(workspaceId),
    supabase
      .from("workspace_members")
      .select("user_id, profile:user_profiles(display_name, first_name, last_name)")
      .eq("workspace_id", workspaceId)
      .eq("status", "active"),
  ]);
  const staffOptions: PickerOption[] = (staffMembers ?? []).map((s) => {
    const profile = s.profile as { display_name?: string | null; first_name?: string | null; last_name?: string | null } | null;
    return { id: s.user_id, label: profile?.display_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Team member" };
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">Track prospective clients through your pipeline.</p>
        </div>
        {createAccess.allowed && (
          <LeadFormDialog workspaceId={workspaceId} leadSources={leadSources} serviceOfferings={serviceOfferings} staff={staffOptions} />
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button asChild variant={view !== "pipeline" ? "secondary" : "ghost"} size="sm">
          <Link href="/leads">Table</Link>
        </Button>
        <Button asChild variant={view === "pipeline" ? "secondary" : "ghost"} size="sm">
          <Link href="/leads?view=pipeline">Pipeline</Link>
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">Couldn&apos;t load leads. Please refresh.</p>}

      {!leads || leads.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No leads yet"
          description="Add your first lead to start tracking prospective clients."
        />
      ) : view === "pipeline" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 overflow-x-auto">
          {LEAD_STATUSES.map((s) => {
            const items = leads.filter((l) => l.status === s);
            return (
              <div key={s} className="min-w-[240px]">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 flex items-center justify-between">
                  {LEAD_STATUS_LABELS[s]}
                  <span className="text-muted-foreground/70">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {items.map((lead) => (
                    <Link
                      key={lead.id}
                      href={`/leads/${lead.id}`}
                      className="block rounded-lg border border-border bg-card p-3 hover:shadow-sm transition-shadow"
                    >
                      <div className="text-sm font-medium">
                        {lead.first_name} {lead.last_name}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{lead.company || lead.email || "—"}</div>
                      <div className="mt-3"><LeadStageSelect leadId={lead.id} value={lead.status} disabled={!editAccess.allowed} /></div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id} className="cursor-pointer">
                  <TableCell>
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.first_name} {lead.last_name}
                    </Link>
                    <div className="text-xs text-muted-foreground">{lead.email}</div>
                  </TableCell>
                  <TableCell>{lead.company || "—"}</TableCell>
                  <TableCell>
                    {editAccess.allowed ? <LeadStageSelect leadId={lead.id} value={lead.status} /> : <Badge variant="secondary">{LEAD_STATUS_LABELS[lead.status]}</Badge>}
                  </TableCell>
                  <TableCell>{lead.source || "—"}</TableCell>
                  <TableCell>{formatDate(lead.consultation_at)}</TableCell>
                  <TableCell>{formatDate(lead.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
