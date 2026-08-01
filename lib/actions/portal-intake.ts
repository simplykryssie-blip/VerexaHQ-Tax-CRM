"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePortalAccess } from "@/lib/auth/portal";
import { isIntakeEditable } from "@/lib/data/portal-intakes";
import {
  saveAnswerSchema,
  householdPersonSchema,
  repeatableEntitySchema,
  deleteByIdSchema,
  type SaveAnswerInput,
  type HouseholdPersonInput,
  type RepeatableEntityInput,
} from "@/lib/validation/portal-intake";
import type { IntakeEntityType } from "@/lib/types";
import type { Json } from "@/types/database";

type ActionResult = { error?: string; success?: true };

async function assertOwnedEditableSubmission(submissionId: string) {
  const { client } = await requirePortalAccess();
  if (!client) return { ok: false as const, error: "No linked client account." };

  const supabase = await createClient();
  const { data: submission, error } = await supabase
    .from("intake_submissions")
    .select("id, client_id, status, locked_at, workspace_id")
    .eq("client_id", client.client.id)
    .eq("id", submissionId)
    .maybeSingle();

  if (error || !submission) {
    return { ok: false as const, error: "Intake not found." };
  }
  if (!isIntakeEditable(submission as never)) {
    return { ok: false as const, error: "This intake can no longer be edited." };
  }

  return {
    ok: true as const,
    supabase,
    clientId: client.client.id,
    workspaceId: submission.workspace_id,
  };
}

export async function saveAnswerAction(input: SaveAnswerInput): Promise<ActionResult> {
  const parsed = saveAnswerSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid answer." };

  const guard = await assertOwnedEditableSubmission(parsed.data.submissionId);
  if (!guard.ok) return { error: guard.error };

  const { error } = await guard.supabase.from("intake_answers").upsert(
    {
      submission_id: parsed.data.submissionId,
      workspace_id: guard.workspaceId,
      field_id: parsed.data.fieldId,
      field_key: parsed.data.fieldKey,
      answer_value: (parsed.data.value === undefined ? null : parsed.data.value) as Json,
      status: "draft",
      source: "client",
    },
    { onConflict: "submission_id,field_id" },
  );

  if (error) return { error: "We couldn't save that answer. Please try again." };

  revalidatePath(`/portal/intakes/${parsed.data.submissionId}`);
  return { success: true };
}

export async function saveHouseholdPersonAction(input: HouseholdPersonInput): Promise<ActionResult> {
  const parsed = householdPersonSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const guard = await assertOwnedEditableSubmission(parsed.data.submissionId);
  if (!guard.ok) return { error: guard.error };

  const payload = {
    submission_id: parsed.data.submissionId,
    workspace_id: guard.workspaceId,
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    date_of_birth: parsed.data.dateOfBirth || null,
    ssn_last4: parsed.data.ssnLast4 || null,
    relationship: parsed.data.relationship || null,
    months_in_home: parsed.data.monthsInHome ?? null,
    is_student: parsed.data.isStudent ?? null,
    is_disabled: parsed.data.isDisabled ?? null,
    occupation: parsed.data.occupation || null,
    details: {} as Json,
    person_role: "dependent",
  };

  const { error } = parsed.data.personId
    ? await guard.supabase
        .from("intake_household_people")
        .update(payload)
        .eq("id", parsed.data.personId)
        .eq("submission_id", parsed.data.submissionId)
    : await guard.supabase.from("intake_household_people").insert(payload);

  if (error) return { error: "We couldn't save this household member. Please try again." };

  revalidatePath(`/portal/intakes/${parsed.data.submissionId}`);
  return { success: true };
}

export async function deleteHouseholdPersonAction(input: {
  submissionId: string;
  id: string;
}): Promise<ActionResult> {
  const parsed = deleteByIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const guard = await assertOwnedEditableSubmission(parsed.data.submissionId);
  if (!guard.ok) return { error: guard.error };

  const { error } = await guard.supabase
    .from("intake_household_people")
    .delete()
    .eq("id", parsed.data.id)
    .eq("submission_id", parsed.data.submissionId);

  if (error) return { error: "We couldn't remove this household member." };

  revalidatePath(`/portal/intakes/${parsed.data.submissionId}`);
  return { success: true };
}

export async function saveRepeatableEntityAction(input: RepeatableEntityInput): Promise<ActionResult> {
  const parsed = repeatableEntitySchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };

  const guard = await assertOwnedEditableSubmission(parsed.data.submissionId);
  if (!guard.ok) return { error: guard.error };

  const payload = {
    submission_id: parsed.data.submissionId,
    workspace_id: guard.workspaceId,
    entity_type: parsed.data.entityType as IntakeEntityType,
    display_name: parsed.data.displayName || null,
    data: parsed.data.data as Json,
  };

  const { error } = parsed.data.entityId
    ? await guard.supabase
        .from("intake_repeatable_entities")
        .update(payload)
        .eq("id", parsed.data.entityId)
        .eq("submission_id", parsed.data.submissionId)
    : await guard.supabase.from("intake_repeatable_entities").insert(payload);

  if (error) return { error: "We couldn't save this entry. Please try again." };

  revalidatePath(`/portal/intakes/${parsed.data.submissionId}`);
  return { success: true };
}

export async function deleteRepeatableEntityAction(input: {
  submissionId: string;
  id: string;
}): Promise<ActionResult> {
  const parsed = deleteByIdSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid request." };

  const guard = await assertOwnedEditableSubmission(parsed.data.submissionId);
  if (!guard.ok) return { error: guard.error };

  const { error } = await guard.supabase
    .from("intake_repeatable_entities")
    .delete()
    .eq("id", parsed.data.id)
    .eq("submission_id", parsed.data.submissionId);

  if (error) return { error: "We couldn't remove this entry." };

  revalidatePath(`/portal/intakes/${parsed.data.submissionId}`);
  return { success: true };
}

export async function submitPortalIntakeAction(submissionId: string): Promise<ActionResult> {
  const guard = await assertOwnedEditableSubmission(submissionId);
  if (!guard.ok) return { error: guard.error };

  const { data, error } = await guard.supabase.rpc("submit_intake", {
    p_submission_id: submissionId,
  });

  if (error) return { error: "We couldn't submit your intake. Please try again." };

  const result = data as { valid?: boolean; submitted?: boolean } | null;
  if (!result?.valid) {
    return { error: "Some required information is still missing. Please review your answers." };
  }

  // submit_intake() silently no-ops (0 rows updated) if the submission was
  // locked between our ownership check and this call — re-verify the
  // status actually changed rather than trusting the RPC's JSON alone.
  const { data: refreshed } = await guard.supabase
    .from("intake_submissions")
    .select("status")
    .eq("id", submissionId)
    .single();

  if (!refreshed || !["submitted", "resubmitted"].includes(refreshed.status)) {
    return { error: "Your intake could not be submitted. Please contact your tax office." };
  }

  revalidatePath(`/portal/intakes/${submissionId}`);
  revalidatePath("/portal/dashboard");
  return { success: true };
}
