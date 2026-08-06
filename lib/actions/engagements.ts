"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace, type WorkspaceContext } from "@/lib/auth/workspace";
import {
  STAFF_ROLES,
  MANAGE_ROLES,
  type EngagementStatus,
  type EngagementPriority,
  type EngagementEfileStatus,
  type TablesUpdate,
} from "@/lib/types";
import {
  addNoteSchema,
  assignUserSchema,
  changeDueDatesSchema,
  changeStatusSchema,
  createEngagementSchema,
  updateEngagementSchema,
  type CreateEngagementInput,
  type UpdateEngagementInput,
} from "@/lib/validation/engagements";
import { checkStatusTransition, checkTransitionPrerequisites, timestampsForStatusChange } from "@/lib/engagements/transitions";

type ActionResult = { error?: string; engagementId?: string };

/**
 * Authenticates the user, resolves their workspace, and checks they hold a
 * staff role. Every action below calls this first (Part 8 step 1-3) — the
 * actual mutation is still gated by RLS (can_manage_engagement) as the
 * final layer of defense, so this is a friendlier pre-check, not the only
 * check.
 */
async function requireStaff(): Promise<
  { workspace: WorkspaceContext; error: undefined } | { workspace: null; error: string }
> {
  const { workspace } = await requireWorkspace();
  if (!workspace || !STAFF_ROLES.includes(workspace.role)) {
    return { workspace: null, error: "You don't have permission to manage engagements in this workspace." };
  }
  return { workspace, error: undefined };
}

function revalidateEngagement(engagementId: string) {
  revalidatePath("/engagements");
  revalidatePath(`/engagements/${engagementId}`);
}

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  engagementId: string,
  activityType: string,
  description: string,
  oldValue?: string | null,
  newValue?: string | null,
  metadata?: Record<string, string | number | boolean | null>,
) {
  await supabase.rpc("log_engagement_activity", {
    p_engagement_id: engagementId,
    p_activity_type: activityType,
    p_description: description,
    p_old_value: oldValue ?? undefined,
    p_new_value: newValue ?? undefined,
    p_metadata: metadata ?? {},
  });
}

export async function createEngagementAction(input: CreateEngagementInput): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };

  const parsed = createEngagementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const supabase = await createClient();

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("id, process_id")
    .eq("id", data.serviceId)
    .eq("workspace_id", workspace.workspace.id)
    .maybeSingle();

  if (serviceError || !service) {
    return { error: "Selected service could not be found." };
  }

  let currentStage: string | null = null;
  if (service.process_id) {
    const { data: firstStage } = await supabase
      .from("process_stages")
      .select("name")
      .eq("process_id", service.process_id)
      .order("display_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    currentStage = firstStage?.name ?? null;
  }

  const { data: row, error } = await supabase
    .from("engagements")
    .insert({
      workspace_id: workspace.workspace.id,
      client_id: data.clientId,
      service_id: data.serviceId,
      workflow_id: service.process_id,
      current_stage: currentStage,
      priority: data.priority,
      due_date: data.dueDate || null,
      internal_reference: data.internalReference || null,
    })
    .select("id")
    .single();

  if (error || !row) {
    return { error: "We couldn't create this engagement. Please try again." };
  }

  revalidateEngagement(row.id);
  return { engagementId: row.id };
}

export async function updateEngagementAction(engagementId: string, input: UpdateEngagementInput): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };

  const parsed = updateEngagementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const patch: TablesUpdate<"tax_engagements"> = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.taxYear !== undefined) patch.tax_year = data.taxYear;
  if (data.engagementType !== undefined) patch.engagement_type = data.engagementType;
  if (data.returnType !== undefined) patch.return_type = data.returnType || null;
  if (data.priority !== undefined) patch.priority = data.priority;
  if (data.dueDate !== undefined) patch.due_date = data.dueDate || null;
  if (data.internalDueDate !== undefined) patch.internal_due_date = data.internalDueDate || null;
  if (data.jurisdiction !== undefined) patch.jurisdiction = data.jurisdiction || null;
  if (data.federalReturnRequired !== undefined) patch.federal_return_required = data.federalReturnRequired;
  if (data.stateReturnRequired !== undefined) patch.state_return_required = data.stateReturnRequired;
  if (data.localReturnRequired !== undefined) patch.local_return_required = data.localReturnRequired;
  if (data.description !== undefined) patch.description = data.description || null;
  if (data.balanceDue !== undefined) patch.balance_due = data.balanceDue;
  if (data.refundAmount !== undefined) patch.refund_amount = data.refundAmount;
  if (data.serviceId !== undefined) patch.service_id = data.serviceId || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("tax_engagements")
    .update(patch)
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id);

  if (error) return { error: "We couldn't save these changes. Please try again." };

  revalidateEngagement(engagementId);
  return { engagementId };
}

async function assignUser(
  engagementId: string,
  userId: string | null,
  column: "primary_preparer_user_id" | "reviewer_user_id" | "responsible_staff_user_id",
  activityType: string,
  description: string,
): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };

  const parsed = assignUserSchema.safeParse({ engagementId, userId });
  if (!parsed.success) return { error: "Invalid input." };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("tax_engagements")
    .select(column)
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id)
    .maybeSingle();

  const patch: TablesUpdate<"tax_engagements"> = { assigned_at: new Date().toISOString() };
  patch[column] = userId;

  const { error } = await supabase
    .from("tax_engagements")
    .update(patch)
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id);

  if (error) return { error: "We couldn't update this assignment." };

  const previousValue = current ? (current as Record<string, string | null>)[column] : null;
  await logActivity(supabase, engagementId, activityType, description, previousValue, userId);

  revalidateEngagement(engagementId);
  return { engagementId };
}

export async function assignPreparerAction(engagementId: string, userId: string | null): Promise<ActionResult> {
  return assignUser(engagementId, userId, "primary_preparer_user_id", "preparer_assigned", "Preparer assigned");
}

export async function assignReviewerAction(engagementId: string, userId: string | null): Promise<ActionResult> {
  return assignUser(engagementId, userId, "reviewer_user_id", "reviewer_assigned", "Reviewer assigned");
}

export async function assignResponsibleStaffAction(engagementId: string, userId: string | null): Promise<ActionResult> {
  return assignUser(engagementId, userId, "responsible_staff_user_id", "responsible_staff_assigned", "Responsible staff assigned");
}

export async function changePriorityAction(engagementId: string, priority: EngagementPriority): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("tax_engagements")
    .select("priority")
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id)
    .maybeSingle();

  const { error } = await supabase
    .from("tax_engagements")
    .update({ priority })
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id);

  if (error) return { error: "We couldn't update the priority." };

  await logActivity(supabase, engagementId, "priority_changed", "Priority changed", current?.priority ?? null, priority);
  revalidateEngagement(engagementId);
  return { engagementId };
}

export async function changeDueDatesAction(input: {
  engagementId: string;
  dueDate?: string;
  internalDueDate?: string;
  extensionDueDate?: string;
}): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };

  const parsed = changeDueDatesSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };
  const data = parsed.data;

  const patch: TablesUpdate<"tax_engagements"> = {};
  if (data.dueDate !== undefined) patch.due_date = data.dueDate || null;
  if (data.internalDueDate !== undefined) patch.internal_due_date = data.internalDueDate || null;
  if (data.extensionDueDate !== undefined) patch.extension_due_date = data.extensionDueDate || null;

  const supabase = await createClient();
  const { error } = await supabase
    .from("tax_engagements")
    .update(patch)
    .eq("id", data.engagementId)
    .eq("workspace_id", workspace.workspace.id);

  if (error) return { error: "We couldn't update the due dates." };

  await logActivity(supabase, data.engagementId, "due_date_changed", "Due dates changed", null, JSON.stringify(patch));
  revalidateEngagement(data.engagementId);
  return { engagementId: data.engagementId };
}

export async function changeStatusAction(input: {
  engagementId: string;
  status: EngagementStatus;
  override?: boolean;
  reason?: string;
}): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };

  const parsed = changeStatusSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };
  const { engagementId, status: toStatus, override, reason } = parsed.data;

  if (override && !MANAGE_ROLES.includes(workspace.role)) {
    return { error: "Only workspace owners/admins/EROs may override a status transition." };
  }
  if (override && !reason?.trim()) {
    return { error: "An override requires a reason." };
  }

  const supabase = await createClient();
  const { data: engagement } = await supabase
    .from("tax_engagements")
    .select("status, primary_preparer_user_id, reviewer_user_id")
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id)
    .maybeSingle();

  if (!engagement) return { error: "Engagement not found." };

  const transitionCheck = checkStatusTransition(engagement.status, toStatus, { override });
  if (!transitionCheck.allowed) return { error: transitionCheck.reason };

  if (!override) {
    const prereqCheck = checkTransitionPrerequisites(engagement, toStatus);
    if (!prereqCheck.allowed) return { error: prereqCheck.reason };
  }

  const timestamps = timestampsForStatusChange(toStatus);
  const patch: TablesUpdate<"tax_engagements"> = { status: toStatus, ...timestamps };

  // filed_at is set on both "filed" and "accepted", but should not be
  // clobbered with a later timestamp if it was already stamped at "filed".
  if (timestamps.filed_at) {
    const { data: existing } = await supabase
      .from("tax_engagements")
      .select("filed_at")
      .eq("id", engagementId)
      .maybeSingle();
    if (existing?.filed_at) delete patch.filed_at;
  }

  const { error } = await supabase
    .from("tax_engagements")
    .update(patch)
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id);

  if (error) return { error: "We couldn't change the status. Please try again." };

  if (override) {
    await logActivity(
      supabase,
      engagementId,
      "override",
      `Status overridden to ${toStatus.replace(/_/g, " ")}: ${reason}`,
      engagement.status,
      toStatus,
      { override: true, reason: reason ?? null },
    );
  }
  // The status-change trigger (log_engagement_status_change) already
  // records the standard status_changed activity row.

  revalidateEngagement(engagementId);
  return { engagementId };
}

export async function markExtensionRequestedAction(engagementId: string): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tax_engagements")
    .update({ extension_requested: true })
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id);

  if (error) return { error: "We couldn't record the extension request." };
  await logActivity(supabase, engagementId, "extension_requested", "Extension marked as requested");
  revalidateEngagement(engagementId);
  return { engagementId };
}

export async function markExtensionFiledAction(engagementId: string): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("tax_engagements")
    .update({ extension_requested: true, extension_filed: true })
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id);

  if (error) return { error: "We couldn't record the extension filing." };
  await logActivity(supabase, engagementId, "extension_filed", "Extension marked as filed");
  revalidateEngagement(engagementId);
  return { engagementId };
}

export async function updateEfileStatusAction(engagementId: string, efileStatus: EngagementEfileStatus): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("tax_engagements")
    .select("efile_status")
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id)
    .maybeSingle();

  const { error } = await supabase
    .from("tax_engagements")
    .update({ efile_status: efileStatus })
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id);

  if (error) return { error: "We couldn't update the e-file status." };
  await logActivity(
    supabase,
    engagementId,
    "efile_status_changed",
    "E-file status changed",
    current?.efile_status ?? null,
    efileStatus,
  );
  revalidateEngagement(engagementId);
  return { engagementId };
}

export async function linkIntakeSubmissionAction(engagementId: string, intakeSubmissionId: string): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("intake_submissions")
    .update({ engagement_id: engagementId })
    .eq("id", intakeSubmissionId)
    .eq("workspace_id", workspace.workspace.id);

  if (error) return { error: "We couldn't link this intake submission." };
  await logActivity(supabase, engagementId, "intake_linked", "Intake submission linked", null, intakeSubmissionId);
  revalidateEngagement(engagementId);
  return { engagementId };
}

export async function linkDocumentRequestAction(engagementId: string, documentRequestId: string): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };

  const supabase = await createClient();
  const { error: linkError } = await supabase
    .from("document_requests")
    .update({ engagement_id: engagementId })
    .eq("id", documentRequestId)
    .eq("workspace_id", workspace.workspace.id);
  if (linkError) return { error: "We couldn't link this document request." };

  const { error } = await supabase
    .from("tax_engagements")
    .update({ document_request_id: documentRequestId })
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id);

  if (error) return { error: "We couldn't set the primary document request." };
  await logActivity(supabase, engagementId, "document_request_linked", "Document request linked", null, documentRequestId);
  revalidateEngagement(engagementId);
  return { engagementId };
}

// --- Named workflow-milestone actions (Part 8), each a thin wrapper over
// changeStatusAction so the transition map / prerequisite checks / activity
// logging stay centralized in one place. ---

export async function submitForReviewAction(engagementId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data } = await supabase.from("tax_engagements").select("status, reviewer_user_id").eq("id", engagementId).maybeSingle();
  const nextStatus: EngagementStatus = data?.reviewer_user_id ? "reviewer_review" : "preparer_review";
  return changeStatusAction({ engagementId, status: nextStatus });
}

export async function markReviewCompleteAction(engagementId: string): Promise<ActionResult> {
  return changeStatusAction({ engagementId, status: "awaiting_signature" });
}

export async function markReadyToFileAction(engagementId: string): Promise<ActionResult> {
  return changeStatusAction({ engagementId, status: "ready_to_file" });
}

export async function markFiledAction(engagementId: string): Promise<ActionResult> {
  return changeStatusAction({ engagementId, status: "filed" });
}

export async function markAcceptedAction(engagementId: string): Promise<ActionResult> {
  return changeStatusAction({ engagementId, status: "accepted" });
}

export async function markRejectedAction(engagementId: string): Promise<ActionResult> {
  return changeStatusAction({ engagementId, status: "rejected" });
}

export async function completeEngagementAction(engagementId: string): Promise<ActionResult> {
  return changeStatusAction({ engagementId, status: "completed" });
}

export async function placeOnHoldAction(engagementId: string, reason: string): Promise<ActionResult> {
  return changeStatusAction({ engagementId, status: "on_hold", override: true, reason });
}

export async function cancelEngagementAction(engagementId: string, reason: string): Promise<ActionResult> {
  return changeStatusAction({ engagementId, status: "cancelled", override: true, reason });
}

export async function archiveEngagementAction(engagementId: string): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };
  if (!MANAGE_ROLES.includes(workspace.role)) {
    return { error: "Only workspace owners/admins/EROs may archive an engagement." };
  }
  return changeStatusAction({ engagementId, status: "archived", override: true, reason: "Archived" });
}

export async function restoreEngagementAction(engagementId: string, restoreStatus: EngagementStatus): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };
  if (!MANAGE_ROLES.includes(workspace.role)) {
    return { error: "Only workspace owners/admins/EROs may restore an archived engagement." };
  }
  return changeStatusAction({ engagementId, status: restoreStatus, override: true, reason: "Restored from archive" });
}

export async function addEngagementNoteAction(input: {
  engagementId: string;
  body: string;
  isClientVisible?: boolean;
  isPinned?: boolean;
}): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };

  const parsed = addNoteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("engagement_notes").insert({
    workspace_id: workspace.workspace.id,
    engagement_id: data.engagementId,
    author_user_id: user?.id ?? null,
    body: data.body,
    is_client_visible: data.isClientVisible,
    is_pinned: data.isPinned,
  });

  if (error) return { error: "We couldn't save this note." };
  await logActivity(supabase, data.engagementId, "note_added", "Internal note added");
  revalidateEngagement(data.engagementId);
  return { engagementId: data.engagementId };
}
