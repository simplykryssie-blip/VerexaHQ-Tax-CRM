import type { SupabaseServerClient } from "@/lib/supabase/server";
import type {
  FormField,
  FormSection,
  IntakeAnswer,
  IntakeDeductionCredit,
  IntakeHouseholdPerson,
  IntakeIncomeSource,
  IntakeRepeatableEntity,
  IntakeSubmission,
  IntakeValidationResult,
} from "@/lib/types";

export async function listPortalIntakes(
  supabase: SupabaseServerClient,
  clientId: string,
): Promise<IntakeSubmission[]> {
  const { data, error } = await supabase
    .from("intake_submissions")
    .select("*")
    .eq("client_id", clientId)
    .order("tax_year", { ascending: false });

  if (error || !data) return [];
  return data;
}

export async function getMostRecentIntake(
  supabase: SupabaseServerClient,
  clientId: string,
): Promise<IntakeSubmission | null> {
  const intakes = await listPortalIntakes(supabase, clientId);
  return intakes[0] ?? null;
}

export type PortalIntakeSection = FormSection & {
  fields: (FormField & { answer: IntakeAnswer | null })[];
};

export type PortalIntakeDetail = {
  submission: IntakeSubmission;
  sections: PortalIntakeSection[];
  household: IntakeHouseholdPerson[];
  income: IntakeIncomeSource[];
  deductions: IntakeDeductionCredit[];
  repeatableEntities: IntakeRepeatableEntity[];
  validationResults: IntakeValidationResult[];
  visibility: Map<string, boolean>;
};

/**
 * Loads everything the client-facing intake renderer needs for one
 * submission. Ownership is verified explicitly against the resolved
 * client id (never trusted from the URL alone) in addition to RLS.
 */
export async function getPortalIntakeDetail(
  supabase: SupabaseServerClient,
  clientId: string,
  submissionId: string,
): Promise<PortalIntakeDetail | null> {
  const { data: submission, error } = await supabase
    .from("intake_submissions")
    .select("*")
    .eq("client_id", clientId)
    .eq("id", submissionId)
    .maybeSingle();

  if (error || !submission) return null;

  const [sectionsResult, fieldsResult, answersResult, householdResult, incomeResult, deductionsResult, entitiesResult, validationResult, visibilityResult] =
    await Promise.all([
      supabase
        .from("form_sections")
        .select("*")
        .eq("template_version_id", submission.template_version_id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("form_fields")
        .select("*")
        .eq("template_version_id", submission.template_version_id)
        .eq("is_staff_only", false)
        .order("sort_order", { ascending: true }),
      supabase.from("intake_answers").select("*").eq("submission_id", submissionId),
      supabase
        .from("intake_household_people")
        .select("*")
        .eq("submission_id", submissionId)
        .order("sort_order", { ascending: true }),
      supabase.from("intake_income_sources").select("*").eq("submission_id", submissionId),
      supabase.from("intake_deductions_credits").select("*").eq("submission_id", submissionId),
      supabase
        .from("intake_repeatable_entities")
        .select("*")
        .eq("submission_id", submissionId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("intake_validation_results")
        .select("*")
        .eq("submission_id", submissionId)
        .eq("is_resolved", false)
        .order("created_at", { ascending: false }),
      supabase.rpc("get_intake_visibility", { p_submission_id: submissionId }),
    ]);

  const answerByField = new Map<string, IntakeAnswer>();
  for (const answer of answersResult.data ?? []) {
    answerByField.set(answer.field_id, answer);
  }

  const visibility = new Map<string, boolean>();
  for (const row of visibilityResult.data ?? []) {
    visibility.set(`${row.target_type}:${row.target_key}`, row.is_visible);
  }

  const fieldsBySection = new Map<string, (FormField & { answer: IntakeAnswer | null })[]>();
  for (const field of fieldsResult.data ?? []) {
    if (!field.section_id) continue;
    const list = fieldsBySection.get(field.section_id) ?? [];
    list.push({ ...field, answer: answerByField.get(field.id) ?? null });
    fieldsBySection.set(field.section_id, list);
  }

  const sections: PortalIntakeSection[] = (sectionsResult.data ?? []).map((section) => ({
    ...section,
    fields: fieldsBySection.get(section.id) ?? [],
  }));

  return {
    submission,
    sections,
    household: householdResult.data ?? [],
    income: incomeResult.data ?? [],
    deductions: deductionsResult.data ?? [],
    repeatableEntities: entitiesResult.data ?? [],
    validationResults: validationResult.data ?? [],
    visibility,
  };
}

export function isSectionVisible(visibility: Map<string, boolean>, section: FormSection) {
  const visible = visibility.get(`section:${section.section_key}`);
  return visible !== false;
}

export function isFieldVisible(visibility: Map<string, boolean>, field: FormField) {
  const visible = visibility.get(`field:${field.field_key}`);
  return visible !== false;
}

export function isIntakeEditable(submission: IntakeSubmission) {
  return (
    submission.locked_at === null &&
    !["approved", "archived"].includes(submission.status)
  );
}
