import { createClient } from "@/lib/supabase/server";

export type CatalogOption = { value: string; label: string };

/** Active lead sources + service offerings visible to a workspace: system
 * defaults (workspace_id null) plus anything the workspace added itself. */
export async function getLeadCatalogOptions(workspaceId: string): Promise<{
  leadSources: CatalogOption[];
  serviceOfferings: CatalogOption[];
}> {
  const supabase = await createClient();
  const [{ data: sources }, { data: offerings }] = await Promise.all([
    supabase
      .from("lead_sources")
      .select("id, label")
      .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("service_offerings")
      .select("id, name")
      .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
      .eq("is_active", true)
      .order("sort_order"),
  ]);

  return {
    leadSources: (sources ?? []).map((s) => ({ value: s.label, label: s.label })),
    serviceOfferings: (offerings ?? []).map((o) => ({ value: o.id, label: o.name })),
  };
}

export async function getLeadServiceInterestIds(leadId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("lead_service_interests").select("service_offering_id").eq("lead_id", leadId);
  return (data ?? []).map((r) => r.service_offering_id);
}

export async function getLeadServiceInterestNames(leadId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("lead_service_interests")
    .select("service_offering:service_offerings(name)")
    .eq("lead_id", leadId);
  return (data ?? [])
    .map((r) => (r.service_offering as { name: string } | null)?.name)
    .filter((n): n is string => Boolean(n));
}

/** The open (not completed/cancelled) "Next Follow-up" task for a lead, if any. */
export async function getLeadFollowUpTask(workspaceId: string, leadId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tasks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("lead_id", leadId)
    .eq("task_type", "lead_follow_up")
    .not("status", "in", "(completed,cancelled)")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Soonest of the lead's next follow-up task and its consultation appointment,
 * for the "next scheduled action" summary on the lead record. */
export function nextScheduledAction(
  consultationAt: string | null,
  followUpDueAt: string | null | undefined,
): { label: string; at: string } | null {
  const candidates: { label: string; at: string }[] = [];
  if (consultationAt) candidates.push({ label: "Consultation appointment", at: consultationAt });
  if (followUpDueAt) candidates.push({ label: "Next follow-up", at: followUpDueAt });
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return candidates[0];
}
