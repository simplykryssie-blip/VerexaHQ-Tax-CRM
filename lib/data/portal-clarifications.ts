import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { FormField, IntakeReviewComment, IntakeSubmission } from "@/lib/types";

export type PortalClarification = IntakeReviewComment & {
  field: FormField | null;
  submission: Pick<IntakeSubmission, "id" | "tax_year"> | null;
};

export async function listPortalClarifications(
  supabase: SupabaseServerClient,
  clientId: string,
): Promise<PortalClarification[]> {
  const { data: submissions } = await supabase
    .from("intake_submissions")
    .select("id, tax_year")
    .eq("client_id", clientId);

  const submissionIds = (submissions ?? []).map((s) => s.id);
  if (submissionIds.length === 0) return [];

  const submissionMap = new Map(submissions!.map((s) => [s.id, s]));

  const { data, error } = await supabase
    .from("intake_review_comments")
    .select("*, field:form_fields(*)")
    .in("submission_id", submissionIds)
    .eq("is_client_visible", true)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    ...(row as unknown as IntakeReviewComment & { field: FormField | null }),
    submission: submissionMap.get(row.submission_id) ?? null,
  }));
}

export async function countOpenClarifications(
  supabase: SupabaseServerClient,
  clientId: string,
): Promise<number> {
  const clarifications = await listPortalClarifications(supabase, clientId);
  return clarifications.filter((c) => !c.resolved_at).length;
}
