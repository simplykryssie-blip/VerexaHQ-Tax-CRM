import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getUserSummaryMap, type UserSummary } from "@/lib/data/users";
import type {
  Client,
  DocumentRequest,
  DocumentRow,
  EngagementActivity,
  EngagementNote,
  IntakeSubmission,
  TaxEngagement,
} from "@/lib/types";
import type { EngagementListFilters } from "@/lib/validation/engagements";
import type { Database } from "@/types/database";

type WorkflowInstance = Database["public"]["Tables"]["engagement_workflow_instances"]["Row"];
type WorkflowStageInstance = Database["public"]["Tables"]["engagement_workflow_stage_instances"]["Row"];
type ProgressTracker = Database["public"]["Tables"]["engagement_progress_trackers"]["Row"];
type EngagementDeadline = Database["public"]["Tables"]["engagement_deadlines"]["Row"];
export type AllowedWorkflowTransition = { stageKey: string; label: string; transitionLabel: string | null; requiresReason: boolean; kind: string };

export const ENGAGEMENTS_PAGE_SIZE = 20;

export type EngagementListItem = TaxEngagement & {
  client: Pick<Client, "id" | "first_name" | "last_name" | "display_name" | "preferred_name" | "company"> | null;
  preparer: UserSummary | null;
  reviewer: UserSummary | null;
  missingItemsCount: number;
};

function dueDateRangeFor(state: EngagementListFilters["dueDateState"]) {
  if (!state || state === "no_due_date") return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  if (state === "overdue") return { lt: todayStr };
  const days = state === "due_soon_7" ? 7 : 30;
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + days);
  return { gte: todayStr, lte: end.toISOString().slice(0, 10) };
}

export async function listEngagements(
  supabase: SupabaseServerClient,
  workspaceId: string,
  filters: EngagementListFilters,
): Promise<{ engagements: EngagementListItem[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * ENGAGEMENTS_PAGE_SIZE;
  const to = from + ENGAGEMENTS_PAGE_SIZE - 1;

  let query = supabase
    .from("tax_engagements")
    .select("*, client:clients(id, first_name, last_name, display_name, preferred_name, company)", {
      count: "exact",
    })
    .eq("workspace_id", workspaceId);

  if (filters.taxYear) query = query.eq("tax_year", filters.taxYear);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.returnType) query = query.eq("return_type", filters.returnType);
  if (filters.engagementType) query = query.eq("engagement_type", filters.engagementType);
  if (filters.preparerUserId) query = query.eq("primary_preparer_user_id", filters.preparerUserId);
  if (filters.reviewerUserId) query = query.eq("reviewer_user_id", filters.reviewerUserId);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.clientId) query = query.eq("client_id", filters.clientId);

  if (filters.dueDateState === "no_due_date") {
    query = query.is("due_date", null);
  } else {
    const range = dueDateRangeFor(filters.dueDateState);
    if (range) {
      if ("lt" in range) query = query.lt("due_date", range.lt);
      else query = query.gte("due_date", range.gte).lte("due_date", range.lte);
    }
  }

  if (filters.q) {
    const term = filters.q.trim().replace(/[%,]/g, "");
    if (term) {
      query = query.or([`title.ilike.%${term}%`, `engagement_number.ilike.%${term}%`].join(","));
    }
  }

  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, to);

  if (error || !data) return { engagements: [], total: 0 };

  const engagementIds = data.map((e) => e.id);
  const userIds = data.flatMap((e) => [e.primary_preparer_user_id, e.reviewer_user_id]);
  const userMap = await getUserSummaryMap(supabase, userIds);
  const missingCounts = await getMissingItemsCounts(supabase, workspaceId, engagementIds);

  return {
    engagements: data.map((row) => ({
      ...row,
      client: (row as unknown as { client: EngagementListItem["client"] }).client,
      preparer: row.primary_preparer_user_id ? userMap.get(row.primary_preparer_user_id) ?? null : null,
      reviewer: row.reviewer_user_id ? userMap.get(row.reviewer_user_id) ?? null : null,
      missingItemsCount: missingCounts.get(row.id) ?? 0,
    })),
    total: count ?? 0,
  };
}

/** Open document-request items (requested/uploaded/under_review) per engagement, via its primary document request. */
async function getMissingItemsCounts(
  supabase: SupabaseServerClient,
  workspaceId: string,
  engagementIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (engagementIds.length === 0) return map;

  const { data: requests } = await supabase
    .from("document_requests")
    .select("id, engagement_id")
    .eq("workspace_id", workspaceId)
    .in("engagement_id", engagementIds);

  if (!requests || requests.length === 0) return map;

  const requestIdToEngagement = new Map(requests.map((r) => [r.id, r.engagement_id as string]));
  const { data: items } = await supabase
    .from("document_request_items")
    .select("request_id, status")
    .eq("workspace_id", workspaceId)
    .in("request_id", Array.from(requestIdToEngagement.keys()))
    .in("status", ["requested", "uploaded", "under_review"]);

  for (const item of items ?? []) {
    const engagementId = requestIdToEngagement.get(item.request_id);
    if (!engagementId) continue;
    map.set(engagementId, (map.get(engagementId) ?? 0) + 1);
  }
  return map;
}

export type EngagementDetail = {
  engagement: TaxEngagement;
  client: Client | null;
  preparer: UserSummary | null;
  reviewer: UserSummary | null;
  responsibleStaff: UserSummary | null;
  documents: DocumentRow[];
  documentRequest: DocumentRequest | null;
  intakeSubmissions: IntakeSubmission[];
  openClarificationsCount: number;
  notes: EngagementNote[];
  activity: EngagementActivity[];
  userMap: Map<string, UserSummary>;
  workflow: WorkflowInstance | null;
  workflowStages: WorkflowStageInstance[];
  workflowTransitions: AllowedWorkflowTransition[];
  progressTracker: ProgressTracker | null;
  deadlines: EngagementDeadline[];
};

export async function getEngagementDetail(
  supabase: SupabaseServerClient,
  workspaceId: string,
  engagementId: string,
): Promise<EngagementDetail | null> {
  const { data: engagement, error } = await supabase
    .from("tax_engagements")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", engagementId)
    .maybeSingle();

  if (error || !engagement) return null;

  const [clientResult, documentsResult, intakeResult, notesResult, activityResult, documentRequestResult] =
    await Promise.all([
      supabase.from("clients").select("*").eq("workspace_id", workspaceId).eq("id", engagement.client_id).maybeSingle(),
      supabase
        .from("documents")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("engagement_id", engagementId)
        .is("deleted_at", null)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("intake_submissions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("engagement_id", engagementId)
        .order("created_at", { ascending: false }),
      supabase
        .from("engagement_notes")
        .select("*")
        .eq("engagement_id", engagementId)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("engagement_status_history")
        .select("*")
        .eq("engagement_id", engagementId)
        .order("changed_at", { ascending: false }),
      engagement.document_request_id
        ? supabase.from("document_requests").select("*").eq("id", engagement.document_request_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const openClarificationsCount = await getOpenClarificationsCount(
    supabase,
    workspaceId,
    (intakeResult.data ?? []).map((s) => s.id),
  );

  const userIds = [
    engagement.primary_preparer_user_id,
    engagement.reviewer_user_id,
    engagement.responsible_staff_user_id,
    ...(activityResult.data ?? []).map((a) => a.changed_by),
    ...(notesResult.data ?? []).map((n) => n.author_user_id),
  ];
  const userMap = await getUserSummaryMap(supabase, userIds);

  const [{ data: workflow }, { data: progressTracker }, { data: deadlines }] = await Promise.all([
    supabase.from("engagement_workflow_instances").select("*").eq("engagement_id",engagementId).maybeSingle(),
    supabase.from("engagement_progress_trackers").select("*").eq("engagement_id",engagementId).maybeSingle(),
    supabase.from("engagement_deadlines").select("*").eq("engagement_id",engagementId).order("due_on"),
  ]);
  let workflowStages: WorkflowStageInstance[] = [];
  let workflowTransitions: AllowedWorkflowTransition[] = [];
  if (workflow) {
    const { data: stageRows } = await supabase.from("engagement_workflow_stage_instances").select("*").eq("workflow_instance_id",workflow.id).order("sort_order");
    workflowStages = stageRows ?? [];
    const current = workflowStages.find((stage) => stage.status === "current");
    if (current?.source_stage_id) {
      const { data: transitions } = await supabase.from("workflow_stage_transitions").select("to_stage_id,label,requires_reason,transition_kind").eq("workflow_definition_id",workflow.workflow_definition_id).eq("from_stage_id",current.source_stage_id).order("sort_order");
      const bySourceId = new Map(workflowStages.filter((stage) => stage.source_stage_id).map((stage) => [stage.source_stage_id as string,stage]));
      workflowTransitions = (transitions ?? []).flatMap((transition) => {
        const target = bySourceId.get(transition.to_stage_id);
        return target ? [{ stageKey: target.stage_key, label: target.label, transitionLabel: transition.label, requiresReason: transition.requires_reason, kind: transition.transition_kind }] : [];
      });
      for (const exception of workflowStages.filter((stage) => stage.stage_kind === "exception" && stage.status !== "current")) {
        if (!workflowTransitions.some((item) => item.stageKey === exception.stage_key)) workflowTransitions.push({ stageKey: exception.stage_key, label: exception.label, transitionLabel: exception.label, requiresReason: true, kind: "exception" });
      }
    }
  }

  return {
    engagement,
    client: clientResult.data ?? null,
    preparer: engagement.primary_preparer_user_id ? userMap.get(engagement.primary_preparer_user_id) ?? null : null,
    reviewer: engagement.reviewer_user_id ? userMap.get(engagement.reviewer_user_id) ?? null : null,
    responsibleStaff: engagement.responsible_staff_user_id
      ? userMap.get(engagement.responsible_staff_user_id) ?? null
      : null,
    documents: documentsResult.data ?? [],
    documentRequest: (documentRequestResult as { data: DocumentRequest | null }).data ?? null,
    intakeSubmissions: intakeResult.data ?? [],
    openClarificationsCount,
    notes: notesResult.data ?? [],
    activity: activityResult.data ?? [],
    userMap,
    workflow: workflow ?? null,
    workflowStages,
    workflowTransitions,
    progressTracker: progressTracker ?? null,
    deadlines: deadlines ?? [],
  };
}

async function getOpenClarificationsCount(
  supabase: SupabaseServerClient,
  workspaceId: string,
  intakeSubmissionIds: string[],
): Promise<number> {
  if (intakeSubmissionIds.length === 0) return 0;
  const { count } = await supabase
    .from("intake_review_comments")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .in("submission_id", intakeSubmissionIds)
    .is("resolved_at", null);
  return count ?? 0;
}

export async function listClientsForPicker(
  supabase: SupabaseServerClient,
  workspaceId: string,
): Promise<Pick<Client, "id" | "first_name" | "last_name" | "display_name" | "preferred_name" | "company">[]> {
  const { data } = await supabase
    .from("clients")
    .select("id, first_name, last_name, display_name, preferred_name, company")
    .eq("workspace_id", workspaceId)
    .order("last_name", { ascending: true });
  return data ?? [];
}
