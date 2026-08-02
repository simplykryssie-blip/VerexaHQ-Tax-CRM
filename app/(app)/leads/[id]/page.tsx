import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LeadFormDialog } from "@/features/leads/lead-form-dialog";
import { ConvertLeadButton } from "@/features/leads/convert-lead-button";
import { LEAD_STATUS_LABELS } from "@/lib/validation/leads";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { LeadStageSelect } from "@/features/leads/lead-stage-select";
import {
  getLeadCatalogOptions,
  getLeadServiceInterestIds,
  getLeadServiceInterestNames,
  getLeadFollowUpTask,
  nextScheduledAction,
} from "@/features/leads/queries";
import type { PickerOption } from "@/features/engagements/client-picker";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace } = await requireWorkspace();
  if (!workspace) return <ForbiddenState />;
  const [viewAccess, editAccess, convertAccess] = await Promise.all([
    requirePermission(workspace.workspace.id, "leads.view"),
    requirePermission(workspace.workspace.id, "leads.edit"),
    requirePermission(workspace.workspace.id, "leads.convert"),
  ]);
  if (!viewAccess.allowed) return <ForbiddenState description={viewAccess.reason} />;
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).eq("workspace_id", workspace.workspace.id).maybeSingle();
  if (!lead) notFound();

  const workspaceId = workspace.workspace.id;
  const [{ leadSources, serviceOfferings }, serviceOfferingIds, serviceInterestNames, followUpTask, { data: staffMembers }] = await Promise.all([
    getLeadCatalogOptions(workspaceId),
    getLeadServiceInterestIds(lead.id),
    getLeadServiceInterestNames(lead.id),
    getLeadFollowUpTask(workspaceId, lead.id),
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
  const nextAction = nextScheduledAction(lead.consultation_at, followUpTask?.due_at);

  return (
    <div className="space-y-4 max-w-3xl">
      <Link href="/leads" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {lead.first_name} {lead.last_name}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {editAccess.allowed ? <LeadStageSelect leadId={lead.id} value={lead.status} /> : <Badge variant="secondary">{LEAD_STATUS_LABELS[lead.status]}</Badge>}
            {lead.company && <span className="text-sm text-muted-foreground">{lead.company}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {editAccess.allowed && (
            <LeadFormDialog
              workspaceId={lead.workspace_id}
              lead={lead}
              leadSources={leadSources}
              serviceOfferings={serviceOfferings}
              staff={staffOptions}
              initialServiceOfferingIds={serviceOfferingIds}
              followUpTask={followUpTask}
              trigger={<Button variant="outline">Edit</Button>}
            />
          )}
          {convertAccess.allowed && <ConvertLeadButton leadId={lead.id} alreadyConverted={!!lead.converted_client_id} />}
        </div>
      </div>

      {lead.converted_client_id && (
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-4 text-sm">
            This lead has been converted.{" "}
            <Link href={`/clients/${lead.converted_client_id}`} className="text-primary font-medium hover:underline">
              View client
            </Link>
          </CardContent>
        </Card>
      )}

      {nextAction && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 text-sm">
            <span className="font-medium">Next scheduled action:</span> {nextAction.label} — {formatDateTime(nextAction.at)}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <Field label="Email" value={lead.email} />
          <Field label="Phone" value={lead.phone} />
          <Field label="Source" value={lead.source} />
          <Field label="Services of interest" value={serviceInterestNames.length > 0 ? serviceInterestNames.join(", ") : lead.service_interest} />
          <Field label="Estimated value" value={formatCurrency(lead.estimated_value)} />
          <Field label="Consultation appointment" value={formatDateTime(lead.consultation_at)} />
          <Field
            label="Next follow-up"
            value={followUpTask?.due_at ? `${formatDateTime(followUpTask.due_at)}${followUpTask.assigned_to_user_id ? ` — ${staffOptions.find((s) => s.id === followUpTask.assigned_to_user_id)?.label ?? ""}` : ""}` : null}
          />
          <Field label="Created" value={formatDateTime(lead.created_at)} />
          {lead.lost_reason && <Field label="Lost reason" value={lead.lost_reason} />}
        </CardContent>
      </Card>

      {followUpTask?.description && (
        <Card>
          <CardHeader>
            <CardTitle>Follow-up notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{followUpTask.description}</CardContent>
        </Card>
      )}

      {lead.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap">{lead.notes}</CardContent>
        </Card>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}
