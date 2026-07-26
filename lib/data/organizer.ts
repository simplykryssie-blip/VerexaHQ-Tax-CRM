import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getUserSummaryMap, type UserSummary } from "@/lib/data/users";
import type { IntakeSubmission } from "@/lib/types";

export type EngagementOrganizerSummary = {
  submission: IntakeSubmission;
  templateName: string | null;
  currentSectionTitle: string | null;
  reviewer: UserSummary | null;
  assignedBy: UserSummary | null;
  missingAnswersCount: number;
  unresolvedClarificationsCount: number;
  reviewedSectionsCount: number;
  totalReviewSectionsCount: number;
  rolledForwardCount: number;
  priorYearSubmissions: { id: string; taxYear: number | null }[];
};

/**
 * Prior organizers for a client, for the rollover picker — used both when an
 * engagement already has an active organizer (via getEngagementOrganizerSummary)
 * and, just as importantly, when it doesn't yet (first-time assignment is
 * exactly when copying a prior year is most useful).
 */
export async function listPriorYearOrganizers(
  supabase: SupabaseServerClient,
  clientId: string,
  excludeEngagementId?: string,
): Promise<{ id: string; taxYear: number | null }[]> {
  let query = supabase
    .from("intake_submissions")
    .select("id, tax_year, engagement_id")
    .eq("client_id", clientId)
    .order("tax_year", { ascending: false })
    .limit(5);

  if (excludeEngagementId) query = query.neq("engagement_id", excludeEngagementId);

  const { data } = await query;
  return (data ?? []).map((s) => ({ id: s.id, taxYear: s.tax_year }));
}

/**
 * Everything the engagement page's Organizer tab needs, in one query batch —
 * reusing the same intake_* tables the client-facing organizer and the
 * existing staff /intakes review workspace already use, not a parallel
 * "organizer assignment" summary table.
 */
export async function getEngagementOrganizerSummary(
  supabase: SupabaseServerClient,
  workspaceId: string,
  engagementId: string,
): Promise<EngagementOrganizerSummary | null> {
  const { data: submission } = await supabase
    .from("intake_submissions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("engagement_id", engagementId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (!submission) return null;

  const [
    templateResult,
    currentSectionResult,
    validationResult,
    clarificationsResult,
    reviewSectionsResult,
    answersRolledResult,
    householdRolledResult,
    entitiesRolledResult,
    priorYearResult,
  ] = await Promise.all([
    supabase.from("templates").select("name").eq("id", submission.template_id).maybeSingle(),
    submission.current_section_id
      ? supabase.from("form_sections").select("title").eq("id", submission.current_section_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("intake_validation_results")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", submission.id)
      .eq("is_resolved", false),
    supabase
      .from("intake_review_comments")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", submission.id)
      .is("resolved_at", null),
    supabase.from("intake_review_sections").select("result").eq("submission_id", submission.id),
    supabase
      .from("intake_answers")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", submission.id)
      .eq("rolled_forward", true)
      .eq("confirmed_by_client", false),
    supabase
      .from("intake_household_people")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", submission.id)
      .eq("rolled_forward", true)
      .eq("confirmed_by_client", false),
    supabase
      .from("intake_repeatable_entities")
      .select("id", { count: "exact", head: true })
      .eq("submission_id", submission.id)
      .eq("rolled_forward", true)
      .eq("confirmed_by_client", false),
    supabase
      .from("intake_submissions")
      .select("id, tax_year")
      .eq("client_id", submission.client_id)
      .neq("id", submission.id)
      .order("tax_year", { ascending: false })
      .limit(5),
  ]);

  const userMap = await getUserSummaryMap(supabase, [submission.reviewed_by, submission.assigned_by]);

  return {
    submission,
    templateName: templateResult.data?.name ?? null,
    currentSectionTitle: (currentSectionResult.data as { title: string } | null)?.title ?? null,
    reviewer: submission.reviewed_by ? userMap.get(submission.reviewed_by) ?? null : null,
    assignedBy: submission.assigned_by ? userMap.get(submission.assigned_by) ?? null : null,
    missingAnswersCount: validationResult.count ?? 0,
    unresolvedClarificationsCount: clarificationsResult.count ?? 0,
    reviewedSectionsCount: (reviewSectionsResult.data ?? []).filter((s) => s.result !== "pending").length,
    totalReviewSectionsCount: (reviewSectionsResult.data ?? []).length,
    rolledForwardCount:
      (answersRolledResult.count ?? 0) + (householdRolledResult.count ?? 0) + (entitiesRolledResult.count ?? 0),
    priorYearSubmissions: (priorYearResult.data ?? []).map((s) => ({ id: s.id, taxYear: s.tax_year })),
  };
}
