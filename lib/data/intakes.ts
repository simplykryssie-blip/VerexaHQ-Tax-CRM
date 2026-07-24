import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getUserSummaryMap, type UserSummary } from "@/lib/data/users";
import { isDocumentItemReceived } from "@/lib/data/document-requests";
import type {
  Client,
  FormField,
  FormSection,
  IntakeAnswer,
  IntakeComplianceRule,
  IntakeDeductionCredit,
  IntakeDocumentRule,
  IntakeHouseholdPerson,
  IntakeIncomeSource,
  IntakeRepeatableEntity,
  IntakeReviewAction,
  IntakeReviewComment,
  IntakeReviewSection,
  IntakeSubmission,
  IntakeSubmissionRevision,
  IntakeSubmissionStatus,
  IntakeValidationResult,
} from "@/lib/types";

export const INTAKES_PAGE_SIZE = 20;

export type IntakeListFilters = {
  taxYear?: number;
  status?: IntakeSubmissionStatus;
  reviewer?: string;
  missingDocuments?: boolean;
  clarificationNeeded?: boolean;
  validationFailures?: boolean;
  completion?: "complete" | "incomplete";
  page?: number;
};

export type IntakeListItem = IntakeSubmission & {
  client: Client | null;
  reviewerName: string | null;
  outstandingClarifications: number;
  outstandingDocuments: number;
  unresolvedValidationFailures: number;
};

export async function listIntakes(
  supabase: SupabaseServerClient,
  workspaceId: string,
  filters: IntakeListFilters,
): Promise<{ intakes: IntakeListItem[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * INTAKES_PAGE_SIZE;
  const to = from + INTAKES_PAGE_SIZE - 1;

  let query = supabase
    .from("intake_submissions")
    .select("*, client:clients(*)", { count: "exact" })
    .eq("workspace_id", workspaceId);

  if (filters.taxYear) query = query.eq("tax_year", filters.taxYear);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.reviewer) query = query.eq("reviewed_by", filters.reviewer);
  if (filters.completion === "complete") query = query.eq("progress_percent", 100);
  if (filters.completion === "incomplete") query = query.lt("progress_percent", 100);

  const { data, count, error } = await query
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (error || !data) return { intakes: [], total: 0 };

  const submissions = data as unknown as (IntakeSubmission & { client: Client | null })[];
  const submissionIds = submissions.map((s) => s.id);

  const [reviewerMap, clarificationMap, validationMap, documentMap] = await Promise.all([
    getUserSummaryMap(supabase, submissions.map((s) => s.reviewed_by)),
    getUnresolvedClarificationCounts(supabase, workspaceId, submissionIds),
    getUnresolvedValidationCounts(supabase, workspaceId, submissionIds),
    getOutstandingDocumentCounts(supabase, workspaceId, submissions),
  ]);

  let intakes: IntakeListItem[] = submissions.map((submission) => ({
    ...submission,
    reviewerName: submission.reviewed_by
      ? reviewerMap.get(submission.reviewed_by)?.name ?? null
      : null,
    outstandingClarifications: clarificationMap.get(submission.id) ?? 0,
    outstandingDocuments: documentMap.get(submission.id) ?? 0,
    unresolvedValidationFailures: validationMap.get(submission.id) ?? 0,
  }));

  if (filters.clarificationNeeded) {
    intakes = intakes.filter((i) => i.outstandingClarifications > 0);
  }
  if (filters.validationFailures) {
    intakes = intakes.filter((i) => i.unresolvedValidationFailures > 0);
  }
  if (filters.missingDocuments) {
    intakes = intakes.filter((i) => i.outstandingDocuments > 0);
  }

  return { intakes, total: count ?? 0 };
}

async function getUnresolvedClarificationCounts(
  supabase: SupabaseServerClient,
  workspaceId: string,
  submissionIds: string[],
) {
  const map = new Map<string, number>();
  if (submissionIds.length === 0) return map;
  const { data } = await supabase
    .from("intake_review_comments")
    .select("submission_id")
    .eq("workspace_id", workspaceId)
    .in("submission_id", submissionIds)
    .is("resolved_at", null);
  for (const row of data ?? []) {
    map.set(row.submission_id, (map.get(row.submission_id) ?? 0) + 1);
  }
  return map;
}

async function getUnresolvedValidationCounts(
  supabase: SupabaseServerClient,
  workspaceId: string,
  submissionIds: string[],
) {
  const map = new Map<string, number>();
  if (submissionIds.length === 0) return map;
  const { data } = await supabase
    .from("intake_validation_results")
    .select("submission_id")
    .eq("workspace_id", workspaceId)
    .in("submission_id", submissionIds)
    .eq("is_resolved", false);
  for (const row of data ?? []) {
    map.set(row.submission_id, (map.get(row.submission_id) ?? 0) + 1);
  }
  return map;
}

/**
 * document_requests has no submission_id column — requests are correlated to
 * an intake by matching client_id + template_version_id, which is how
 * generate_intake_document_request() links them. Best-effort by design.
 */
async function getOutstandingDocumentCounts(
  supabase: SupabaseServerClient,
  workspaceId: string,
  submissions: Pick<IntakeSubmission, "id" | "client_id" | "template_version_id">[],
) {
  const map = new Map<string, number>();
  const clientIds = Array.from(new Set(submissions.map((s) => s.client_id)));
  if (clientIds.length === 0) return map;

  const { data: requests } = await supabase
    .from("document_requests")
    .select("id, client_id, template_version_id")
    .eq("workspace_id", workspaceId)
    .in("client_id", clientIds);

  if (!requests || requests.length === 0) return map;

  const { data: items } = await supabase
    .from("document_request_items")
    .select("request_id, status")
    .eq("workspace_id", workspaceId)
    .in("request_id", requests.map((r) => r.id));

  const statsByRequest = new Map<string, { total: number; received: number }>();
  for (const item of items ?? []) {
    const stats = statsByRequest.get(item.request_id) ?? { total: 0, received: 0 };
    stats.total += 1;
    if (isDocumentItemReceived(item.status)) stats.received += 1;
    statsByRequest.set(item.request_id, stats);
  }

  for (const submission of submissions) {
    const matching = requests.filter(
      (r) => r.client_id === submission.client_id && r.template_version_id === submission.template_version_id,
    );
    const outstanding = matching.reduce((sum, r) => {
      const stats = statsByRequest.get(r.id);
      if (!stats) return sum;
      return sum + (stats.total - stats.received);
    }, 0);
    map.set(submission.id, outstanding);
  }

  return map;
}

export type IntakeDetail = {
  submission: IntakeSubmission;
  client: Client | null;
  reviewer: UserSummary | null;
  assignedBy: UserSummary | null;
  household: IntakeHouseholdPerson[];
  income: IntakeIncomeSource[];
  deductions: IntakeDeductionCredit[];
  repeatableEntities: IntakeRepeatableEntity[];
  answers: (IntakeAnswer & { field: FormField | null })[];
  validationResults: IntakeValidationResult[];
  documentRules: IntakeDocumentRule[];
  complianceRules: IntakeComplianceRule[];
  reviewSections: (IntakeReviewSection & { section: FormSection | null })[];
  reviewActions: (IntakeReviewAction & { field: FormField | null })[];
  reviewComments: (IntakeReviewComment & { field: FormField | null })[];
  revisions: IntakeSubmissionRevision[];
  userMap: Map<string, UserSummary>;
};

export async function getIntakeDetail(
  supabase: SupabaseServerClient,
  workspaceId: string,
  submissionId: string,
): Promise<IntakeDetail | null> {
  const { data: submission, error } = await supabase
    .from("intake_submissions")
    .select("*, client:clients(*)")
    .eq("workspace_id", workspaceId)
    .eq("id", submissionId)
    .maybeSingle();

  if (error || !submission) return null;

  const { client, ...submissionRow } = submission as IntakeSubmission & { client: Client | null };

  const [
    householdResult,
    incomeResult,
    deductionsResult,
    entitiesResult,
    answersResult,
    validationResult,
    documentRulesResult,
    complianceRulesResult,
    reviewSectionsResult,
    reviewActionsResult,
    reviewCommentsResult,
    revisionsResult,
  ] = await Promise.all([
    supabase
      .from("intake_household_people")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("submission_id", submissionId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("intake_income_sources")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("submission_id", submissionId),
    supabase
      .from("intake_deductions_credits")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("submission_id", submissionId),
    supabase
      .from("intake_repeatable_entities")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("submission_id", submissionId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("intake_answers")
      .select("*, field:form_fields(*)")
      .eq("workspace_id", workspaceId)
      .eq("submission_id", submissionId),
    supabase
      .from("intake_validation_results")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false }),
    supabase
      .from("intake_document_rules")
      .select("*")
      .eq("template_version_id", submissionRow.template_version_id)
      .order("priority", { ascending: true }),
    supabase
      .from("intake_compliance_rules")
      .select("*")
      .eq("template_version_id", submissionRow.template_version_id)
      .order("priority", { ascending: true }),
    supabase
      .from("intake_review_sections")
      .select("*, section:form_sections(*)")
      .eq("workspace_id", workspaceId)
      .eq("submission_id", submissionId),
    supabase
      .from("intake_review_actions")
      .select("*, field:form_fields(*)")
      .eq("workspace_id", workspaceId)
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false }),
    supabase
      .from("intake_review_comments")
      .select("*, field:form_fields(*)")
      .eq("workspace_id", workspaceId)
      .eq("submission_id", submissionId)
      .order("created_at", { ascending: false }),
    supabase
      .from("intake_submission_revisions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("submission_id", submissionId)
      .order("revision_number", { ascending: false }),
  ]);

  const reviewSections = (reviewSectionsResult.data ?? []).sort((a, b) => {
    const orderA = (a as unknown as { section: FormSection | null }).section?.sort_order ?? 0;
    const orderB = (b as unknown as { section: FormSection | null }).section?.sort_order ?? 0;
    return orderA - orderB;
  }) as (IntakeReviewSection & { section: FormSection | null })[];

  const reviewActions = (reviewActionsResult.data ?? []) as (IntakeReviewAction & {
    field: FormField | null;
  })[];
  const reviewComments = (reviewCommentsResult.data ?? []) as (IntakeReviewComment & {
    field: FormField | null;
  })[];

  const revisions = revisionsResult.data ?? [];

  const userIds = [
    submissionRow.reviewed_by,
    submissionRow.assigned_by,
    ...reviewActions.map((a) => a.created_by),
    ...reviewComments.map((c) => c.created_by),
    ...revisions.map((r) => r.created_by),
  ];
  const userMap = await getUserSummaryMap(supabase, userIds);

  return {
    submission: submissionRow,
    client,
    reviewer: submissionRow.reviewed_by ? userMap.get(submissionRow.reviewed_by) ?? null : null,
    assignedBy: submissionRow.assigned_by ? userMap.get(submissionRow.assigned_by) ?? null : null,
    household: householdResult.data ?? [],
    income: incomeResult.data ?? [],
    deductions: deductionsResult.data ?? [],
    repeatableEntities: entitiesResult.data ?? [],
    answers: (answersResult.data ?? []) as (IntakeAnswer & { field: FormField | null })[],
    validationResults: validationResult.data ?? [],
    documentRules: documentRulesResult.data ?? [],
    complianceRules: complianceRulesResult.data ?? [],
    reviewSections,
    reviewActions,
    reviewComments,
    revisions,
    userMap,
  };
}

export async function getDistinctTaxYears(
  supabase: SupabaseServerClient,
  workspaceId: string,
): Promise<number[]> {
  const { data } = await supabase
    .from("intake_submissions")
    .select("tax_year")
    .eq("workspace_id", workspaceId)
    .not("tax_year", "is", null);

  const years = Array.from(new Set((data ?? []).map((r) => r.tax_year).filter((y): y is number => y !== null)));
  return years.sort((a, b) => b - a);
}
