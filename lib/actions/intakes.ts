"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceRole } from "@/lib/auth/workspace";
import { REVIEW_ROLES, STAFF_ROLES, type MembershipRole } from "@/lib/types";
import {
  requestClarificationSchema,
  resolveClarificationSchema,
  reviewSectionSchema,
  reopenIntakeSchema,
  type RequestClarificationInput,
  type ResolveClarificationInput,
  type ReviewSectionInput,
  type ReopenIntakeInput,
} from "@/lib/validation/intakes";

type ActionResult = { error?: string; success?: true };

function dbErrorMessage(error: { message: string } | null) {
  if (!error) return "Something went wrong. Please try again.";
  // Postgres RAISE EXCEPTION messages from the intake functions are meant for
  // staff (e.g. "Submission is not in a reviewable state") — safe to surface.
  return error.message;
}

async function guard(allowedRoles: MembershipRole[]) {
  const { allowed, workspace } = await requireWorkspaceRole(allowedRoles);
  if (!allowed || !workspace) {
    return { ok: false as const, error: "You don't have permission to do this in this workspace." };
  }
  return { ok: true as const, workspace };
}

export async function beginReviewAction(submissionId: string): Promise<ActionResult> {
  const guarded = await guard(REVIEW_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("begin_intake_review", { p_submission_id: submissionId });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath(`/intakes/${submissionId}`);
  return { success: true };
}

export async function validateIntakeAction(submissionId: string): Promise<ActionResult> {
  const guarded = await guard(STAFF_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("validate_intake_submission", { p_submission_id: submissionId });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath(`/intakes/${submissionId}`);
  return { success: true };
}

export async function evaluateComplianceAction(submissionId: string): Promise<ActionResult> {
  const guarded = await guard(REVIEW_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("evaluate_intake_compliance", { p_submission_id: submissionId });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath(`/intakes/${submissionId}`);
  return { success: true };
}

export async function generateDocumentRequestAction(
  submissionId: string,
  send: boolean,
): Promise<ActionResult> {
  const guarded = await guard(STAFF_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_intake_document_request", {
    p_submission_id: submissionId,
    p_send: send,
  });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath(`/intakes/${submissionId}`);
  revalidatePath("/document-requests");
  return { success: true };
}

export async function requestClarificationAction(
  input: RequestClarificationInput,
): Promise<ActionResult> {
  const parsed = requestClarificationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const guarded = await guard(STAFF_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_intake_clarification", {
    p_submission_id: parsed.data.submissionId,
    p_field_id: parsed.data.fieldId,
    p_comment: parsed.data.comment,
    p_client_visible: parsed.data.clientVisible,
  });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath(`/intakes/${parsed.data.submissionId}`);
  return { success: true };
}

export async function resolveClarificationAction(
  input: ResolveClarificationInput,
  submissionId: string,
): Promise<ActionResult> {
  const parsed = resolveClarificationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const guarded = await guard(STAFF_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_intake_clarification", {
    p_comment_id: parsed.data.commentId,
    p_resolution: parsed.data.resolution,
  });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath(`/intakes/${submissionId}`);
  return { success: true };
}

export async function reviewSectionAction(input: ReviewSectionInput): Promise<ActionResult> {
  const parsed = reviewSectionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const guarded = await guard(REVIEW_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_intake_section", {
    p_submission_id: parsed.data.submissionId,
    p_section_id: parsed.data.sectionId,
    p_result: parsed.data.result,
    p_notes: parsed.data.notes,
  });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath(`/intakes/${parsed.data.submissionId}`);
  return { success: true };
}

export async function completeReviewAction(submissionId: string): Promise<ActionResult> {
  const guarded = await guard(REVIEW_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_intake_review", { p_submission_id: submissionId });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath(`/intakes/${submissionId}`);
  return { success: true };
}

export async function approveAndLockAction(submissionId: string): Promise<ActionResult> {
  const guarded = await guard(REVIEW_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_and_lock_intake", { p_submission_id: submissionId });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath(`/intakes/${submissionId}`);
  return { success: true };
}

export async function reopenIntakeAction(input: ReopenIntakeInput): Promise<ActionResult> {
  const parsed = reopenIntakeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const guarded = await guard(REVIEW_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reopen_intake", {
    p_submission_id: parsed.data.submissionId,
    p_reason: parsed.data.reason,
  });
  if (error) return { error: dbErrorMessage(error) };

  revalidatePath(`/intakes/${parsed.data.submissionId}`);
  return { success: true };
}
