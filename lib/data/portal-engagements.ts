import type { SupabaseServerClient } from "@/lib/supabase/server";

/**
 * Client-safe engagement projection (Part 7). Postgres RLS is row-level
 * only, so column-level safety is enforced here by explicitly selecting a
 * fixed, narrow list of columns — the same pattern already used for
 * clients.ssn_last4/ein_last4 elsewhere in this codebase. Never widen this
 * to select("*"): preparer/reviewer identities, internal due dates,
 * internal notes, and internal payment/balance fields must never reach the
 * client bundle.
 */
const PORTAL_ENGAGEMENT_COLUMNS =
  "id, engagement_number, title, tax_year, return_type, engagement_type, status, due_date, filed_at, completed_at, extension_requested, extension_filed, document_request_id, created_at, updated_at";

export type PortalEngagementRow = {
  id: string;
  engagement_number: string | null;
  title: string;
  tax_year: number | null;
  return_type: string | null;
  engagement_type: string;
  status: string;
  due_date: string | null;
  filed_at: string | null;
  completed_at: string | null;
  extension_requested: boolean;
  extension_filed: boolean;
  document_request_id: string | null;
  created_at: string;
  updated_at: string;
};

export type PortalEngagementSummary = PortalEngagementRow & {
  documentRequestStatus: string | null;
  intakeStatus: string | null;
  openClarificationsCount: number;
};

async function attachRelatedStatuses(
  supabase: SupabaseServerClient,
  clientId: string,
  rows: PortalEngagementRow[],
): Promise<PortalEngagementSummary[]> {
  if (rows.length === 0) return [];

  const engagementIds = rows.map((r) => r.id);
  const documentRequestIds = rows.map((r) => r.document_request_id).filter((id): id is string => !!id);

  const [documentRequestsResult, intakesResult] = await Promise.all([
    documentRequestIds.length
      ? supabase.from("document_requests").select("id, status").in("id", documentRequestIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("intake_submissions")
      .select("id, status, engagement_id")
      .eq("client_id", clientId)
      .in("engagement_id", engagementIds),
  ]);

  const documentRequestStatusById = new Map((documentRequestsResult.data ?? []).map((r) => [r.id, r.status]));
  const intakesByEngagement = new Map<string, { id: string; status: string }[]>();
  for (const intake of intakesResult.data ?? []) {
    if (!intake.engagement_id) continue;
    const list = intakesByEngagement.get(intake.engagement_id) ?? [];
    list.push({ id: intake.id, status: intake.status });
    intakesByEngagement.set(intake.engagement_id, list);
  }

  const allIntakeIds = (intakesResult.data ?? []).map((i) => i.id);
  const clarificationsByIntake = await countClientVisibleOpenClarifications(supabase, allIntakeIds);

  return rows.map((row) => {
    const intakes = intakesByEngagement.get(row.id) ?? [];
    const openClarificationsCount = intakes.reduce(
      (sum, intake) => sum + (clarificationsByIntake.get(intake.id) ?? 0),
      0,
    );
    return {
      ...row,
      documentRequestStatus: row.document_request_id
        ? documentRequestStatusById.get(row.document_request_id) ?? null
        : null,
      intakeStatus: intakes[0]?.status ?? null,
      openClarificationsCount,
    };
  });
}

async function countClientVisibleOpenClarifications(
  supabase: SupabaseServerClient,
  intakeSubmissionIds: string[],
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (intakeSubmissionIds.length === 0) return map;

  const { data } = await supabase
    .from("intake_review_comments")
    .select("submission_id")
    .in("submission_id", intakeSubmissionIds)
    .eq("is_client_visible", true)
    .is("resolved_at", null);

  for (const row of data ?? []) {
    map.set(row.submission_id, (map.get(row.submission_id) ?? 0) + 1);
  }
  return map;
}

export async function listPortalEngagements(
  supabase: SupabaseServerClient,
  clientId: string,
): Promise<PortalEngagementSummary[]> {
  const { data, error } = await supabase
    .from("tax_engagements")
    .select(PORTAL_ENGAGEMENT_COLUMNS)
    .eq("client_id", clientId)
    .order("tax_year", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return attachRelatedStatuses(supabase, clientId, data);
}

export async function getPortalEngagementDetail(
  supabase: SupabaseServerClient,
  clientId: string,
  engagementId: string,
): Promise<PortalEngagementSummary | null> {
  const { data, error } = await supabase
    .from("tax_engagements")
    .select(PORTAL_ENGAGEMENT_COLUMNS)
    // Ownership is verified explicitly against the resolved client id (never
    // trusted from the URL alone) in addition to RLS.
    .eq("client_id", clientId)
    .eq("id", engagementId)
    .maybeSingle();

  if (error || !data) return null;
  const [summary] = await attachRelatedStatuses(supabase, clientId, [data]);
  return summary ?? null;
}

export async function countActivePortalEngagements(
  supabase: SupabaseServerClient,
  clientId: string,
): Promise<number> {
  const { count } = await supabase
    .from("tax_engagements")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId)
    .not("status", "in", "(completed,cancelled,archived)");

  return count ?? 0;
}
