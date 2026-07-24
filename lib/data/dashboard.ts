import type { SupabaseServerClient } from "@/lib/supabase/server";
import type {
  Client,
  DocumentRequest,
  IntakeSubmission,
  IntakeSubmissionStatus,
} from "@/lib/types";

export type DashboardMetrics = {
  activeClients: number;
  intakesNotStarted: number;
  intakesInProgress: number;
  intakesSubmitted: number;
  intakesUnderReview: number;
  intakesNeedingClarification: number;
  intakesApproved: number;
  openDocumentRequests: number;
};

export type IntakeWithClient = IntakeSubmission & { client: Client | null };
export type DocumentRequestWithClient = DocumentRequest & { client: Client | null };

export type ReviewActivityItem = {
  id: string;
  actionType: string;
  createdAt: string;
  createdBy: string | null;
  submissionId: string;
  client: Client | null;
  taxYear: number | null;
};

export type DashboardData = {
  metrics: DashboardMetrics;
  recentClients: Client[];
  intakesNeedingAttention: IntakeWithClient[];
  documentRequestsDue: DocumentRequestWithClient[];
  recentReviewActivity: ReviewActivityItem[];
};

async function countIntakesByStatus(
  supabase: SupabaseServerClient,
  workspaceId: string,
  status: IntakeSubmissionStatus,
) {
  const { count } = await supabase
    .from("intake_submissions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", status);
  return count ?? 0;
}

export async function getDashboardData(
  supabase: SupabaseServerClient,
  workspaceId: string,
): Promise<DashboardData> {
  const [
    activeClientsResult,
    notStarted,
    inProgress,
    submitted,
    underReview,
    needsClarification,
    approved,
    openDocRequestsResult,
    recentClientsResult,
    needingAttentionResult,
    docRequestsDueResult,
    reviewActivityResult,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "active"),
    countIntakesByStatus(supabase, workspaceId, "not_started"),
    countIntakesByStatus(supabase, workspaceId, "in_progress"),
    countIntakesByStatus(supabase, workspaceId, "submitted"),
    countIntakesByStatus(supabase, workspaceId, "under_review"),
    countIntakesByStatus(supabase, workspaceId, "changes_requested"),
    countIntakesByStatus(supabase, workspaceId, "approved"),
    supabase
      .from("document_requests")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("status", ["draft", "sent", "viewed", "in_progress", "partially_complete"]),
    supabase
      .from("clients")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("intake_submissions")
      .select("*, client:clients(*)")
      .eq("workspace_id", workspaceId)
      .in("status", ["under_review", "changes_requested", "submitted", "resubmitted"])
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("document_requests")
      .select("*, client:clients(*)")
      .eq("workspace_id", workspaceId)
      .not("due_date", "is", null)
      .not("status", "in", "(completed,cancelled,expired)")
      .order("due_date", { ascending: true })
      .limit(6),
    supabase
      .from("intake_review_actions")
      .select("id, action_type, created_at, created_by, submission_id, submission:intake_submissions(client:clients(*), tax_year)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const reviewActivity: ReviewActivityItem[] = (reviewActivityResult.data ?? []).map(
    (action) => {
      const submission = action.submission as unknown as
        | { client: Client | null; tax_year: number | null }
        | null;
      return {
        id: action.id,
        actionType: action.action_type,
        createdAt: action.created_at,
        createdBy: action.created_by,
        submissionId: action.submission_id,
        client: submission?.client ?? null,
        taxYear: submission?.tax_year ?? null,
      };
    },
  );

  return {
    metrics: {
      activeClients: activeClientsResult.count ?? 0,
      intakesNotStarted: notStarted,
      intakesInProgress: inProgress,
      intakesSubmitted: submitted,
      intakesUnderReview: underReview,
      intakesNeedingClarification: needsClarification,
      intakesApproved: approved,
      openDocumentRequests: openDocRequestsResult.count ?? 0,
    },
    recentClients: recentClientsResult.data ?? [],
    intakesNeedingAttention: (needingAttentionResult.data ?? []) as IntakeWithClient[],
    documentRequestsDue: (docRequestsDueResult.data ?? []) as DocumentRequestWithClient[],
    recentReviewActivity: reviewActivity,
  };
}
