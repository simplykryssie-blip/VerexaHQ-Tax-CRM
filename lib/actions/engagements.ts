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
import { requirePermission } from "@/lib/permissions/granular";
import {
  calculateEngagementDeadlines,
  deadlineScheduleAsJson,
  primaryDeadlines,
  US_JURISDICTIONS,
  type JurisdictionCode,
} from "@/lib/tax/deadlines";

type ActionResult = {
  error?: string;
  warning?: string;
  engagementId?: string;
  sendPortalInvite?: boolean;
  clientId?: string;
  activation?: Record<string, unknown>;
};

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

  const createPermission = await requirePermission(workspace.workspace.id, "engagements.create");
  if (!createPermission.allowed) return { error: createPermission.reason };

  const parsed = createEngagementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;
  if (data.activationMode !== "save_draft") {
    const activatePermission = await requirePermission(workspace.workspace.id, "engagements.activate");
    if (!activatePermission.allowed) return { error: activatePermission.reason };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: clientRecord } = await supabase
    .from("clients")
    .select("id, email, portal_user_id, assigned_reviewer_user_id")
    .eq("id", data.clientId)
    .eq("workspace_id", workspace.workspace.id)
    .maybeSingle();
  if (!clientRecord) return { error: "Client not found in this workspace." };

  let reviewerUserId = data.reviewerUserId || clientRecord.assigned_reviewer_user_id || null;
  if (workspace.role === "preparer") {
    const { data: eroMembership } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspace.workspace.id)
      .eq("role", "ero")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    reviewerUserId = clientRecord.assigned_reviewer_user_id || eroMembership?.user_id || null;
  } else if (!reviewerUserId && ["owner", "admin", "ero", "reviewer"].includes(workspace.role)) {
    reviewerUserId = user?.id ?? null;
  }

  if (reviewerUserId) {
    const { data: reviewerMembership } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspace.workspace.id)
      .eq("user_id", reviewerUserId)
      .eq("status", "active")
      .maybeSingle();
    if (!reviewerMembership) return { error: "Choose an active staff member in this tax office as reviewer." };
  }

  const validJurisdictions = new Set(US_JURISDICTIONS.map(([code]) => code));
  const jurisdictions = data.jurisdictions.filter(
    (code): code is JurisdictionCode => validJurisdictions.has(code as JurisdictionCode),
  );
  const schedule = calculateEngagementDeadlines({
    taxYear: data.taxYear,
    returnType: data.returnType || null,
    fiscalYearEnd: data.fiscalYearEnd || null,
    federalRequired: data.federalReturnRequired,
    jurisdictions,
  });
  const automatic = primaryDeadlines(schedule);
  const metadata = {
    activation_mode: data.activationMode,
    jurisdictions,
    fiscal_year_end: data.fiscalYearEnd || null,
    deadline_schedule: deadlineScheduleAsJson(schedule),
    staff_deadlines: {
      client_document_deadline: data.clientDocumentDueDate || null,
      internal_preparation_target: data.internalDueDate || null,
      reviewer_deadline: data.reviewerDueDate || null,
      signature_deadline: data.signatureDueDate || null,
      custom: data.customDeadlineDate
        ? { label: data.customDeadlineLabel || "Custom deadline", date: data.customDeadlineDate }
        : null,
    },
  };

  const { data: row, error } = await supabase
    .from("tax_engagements")
    .insert({
      workspace_id: workspace.workspace.id,
      client_id: data.clientId,
      service_id: data.serviceId || null,
      title: data.title,
      tax_year: data.taxYear,
      engagement_type: data.engagementType,
      return_type: data.returnType || null,
      status: "draft",
      priority: data.priority,
      primary_preparer_user_id: data.preparerUserId || null,
      reviewer_user_id: reviewerUserId,
      responsible_staff_user_id: data.responsibleStaffUserId || null,
      assigned_at: data.preparerUserId || reviewerUserId ? new Date().toISOString() : null,
      due_date: automatic.filingDate,
      internal_due_date: data.internalDueDate || null,
      extension_due_date: data.extensionFiled ? automatic.extensionDate : null,
      extension_requested: data.extensionFiled,
      extension_filed: data.extensionFiled,
      jurisdiction: jurisdictions.join(", ") || null,
      federal_return_required: data.federalReturnRequired,
      state_return_required: jurisdictions.length > 0,
      local_return_required: data.localReturnRequired,
      description: data.description || null,
      document_request_id: data.documentRequestId || null,
      created_by: user?.id ?? null,
      opened_at: data.activationMode === "save_draft" ? null : new Date().toISOString(),
      metadata,
    })
    .select("id")
    .single();

  if (error || !row) {
    return { error: "We couldn't create this engagement. Please try again." };
  }

  if (data.intakeSubmissionId) {
    await supabase
      .from("intake_submissions")
      .update({ engagement_id: row.id })
      .eq("id", data.intakeSubmissionId)
      .eq("workspace_id", workspace.workspace.id);
  }

  await supabase
    .from("clients")
    .update({ status: "active", assigned_reviewer_user_id: reviewerUserId })
    .eq("id", data.clientId)
    .eq("workspace_id", workspace.workspace.id);

  let warning = schedule.warnings.length ? schedule.warnings.join(" ") : undefined;
  let activation: Record<string, unknown> | undefined;
  if (data.activationMode !== "save_draft") {
    const activationMode = data.activationMode === "activate_and_send" ? "activate_and_send" : "activate_without_sending";
    const { data: activationResult, error: activationError } = await supabase.rpc("activate_tax_engagement", {
      p_engagement_id: row.id,
      p_activation_mode: activationMode,
    });
    if (activationError) return { error: `The draft was created, but activation failed: ${activationError.message}` };
    if (activationResult && typeof activationResult === "object" && !Array.isArray(activationResult)) {
      activation = activationResult as Record<string, unknown>;
      const rpcWarnings = Array.isArray(activation.warnings) ? activation.warnings.filter((value): value is string => typeof value === "string") : [];
      warning = [warning, ...rpcWarnings].filter(Boolean).join(" ") || undefined;
    }
  }

  revalidateEngagement(row.id);
  return {
    engagementId: row.id,
    clientId: data.clientId,
    sendPortalInvite: false,
    warning,
    activation,
  };
}

export async function updateEngagementAction(engagementId: string, input: UpdateEngagementInput): Promise<ActionResult> {
  const { workspace, error: authError } = await requireStaff();
  if (!workspace) return { error: authError };

  const parsed = updateEngagementSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("tax_engagements")
    .select("metadata, tax_year, return_type, federal_return_required, jurisdiction")
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id)
    .maybeSingle();
  if (!current) return { error: "Engagement not found." };

  const validJurisdictions = new Set(US_JURISDICTIONS.map(([code]) => code));
  const jurisdictions = (data.jurisdictions ?? current.jurisdiction?.split(",").map((value) => value.trim()) ?? [])
    .filter((code): code is JurisdictionCode => validJurisdictions.has(code as JurisdictionCode));
  const schedule = calculateEngagementDeadlines({
    taxYear: data.taxYear ?? current.tax_year ?? new Date().getFullYear(),
    returnType: data.returnType === undefined ? current.return_type : data.returnType || null,
    fiscalYearEnd: data.fiscalYearEnd || null,
    federalRequired: data.federalReturnRequired ?? current.federal_return_required,
    jurisdictions,
  });
  const automatic = primaryDeadlines(schedule);
  const currentMetadata = (current.metadata && typeof current.metadata === "object" && !Array.isArray(current.metadata)
    ? current.metadata
    : {}) as Record<string, unknown>;
  const metadata = {
    ...currentMetadata,
    jurisdictions,
    fiscal_year_end: data.fiscalYearEnd || null,
    deadline_schedule: deadlineScheduleAsJson(schedule),
    staff_deadlines: {
      client_document_deadline: data.clientDocumentDueDate || null,
      internal_preparation_target: data.internalDueDate || null,
      reviewer_deadline: data.reviewerDueDate || null,
      signature_deadline: data.signatureDueDate || null,
      custom: data.customDeadlineDate
        ? { label: data.customDeadlineLabel || "Custom deadline", date: data.customDeadlineDate }
        : null,
    },
  };

  const patch: TablesUpdate<"tax_engagements"> = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.taxYear !== undefined) patch.tax_year = data.taxYear;
  if (data.engagementType !== undefined) patch.engagement_type = data.engagementType;
  if (data.returnType !== undefined) patch.return_type = data.returnType || null;
  if (data.priority !== undefined) patch.priority = data.priority;
  patch.due_date = automatic.filingDate;
  if (data.internalDueDate !== undefined) patch.internal_due_date = data.internalDueDate || null;
  patch.extension_due_date = data.extensionFiled ? automatic.extensionDate : null;
  patch.extension_requested = Boolean(data.extensionFiled);
  patch.extension_filed = Boolean(data.extensionFiled);
  patch.jurisdiction = jurisdictions.join(", ") || null;
  if (data.federalReturnRequired !== undefined) patch.federal_return_required = data.federalReturnRequired;
  patch.state_return_required = jurisdictions.length > 0;
  if (data.localReturnRequired !== undefined) patch.local_return_required = data.localReturnRequired;
  if (data.description !== undefined) patch.description = data.description || null;
  if (data.balanceDue !== undefined) patch.balance_due = data.balanceDue;
  if (data.refundAmount !== undefined) patch.refund_amount = data.refundAmount;
  if (data.serviceId !== undefined) patch.service_id = data.serviceId || null;
  patch.metadata = metadata;

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
  if (userId) {
    const { data: activeMember } = await supabase
      .from("workspace_members")
      .select("user_id")
      .eq("workspace_id", workspace.workspace.id)
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();
    if (!activeMember) return { error: "That person is not active staff in this tax office." };
  }
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
  const { workspace, error } = await requireStaff();
  if (!workspace) return { error };
  if (workspace.role === "preparer") {
    return { error: "The connected ERO controls reviewer assignment for PTIN preparer accounts." };
  }
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
  const { data: engagement } = await supabase
    .from("tax_engagements")
    .select("metadata")
    .eq("id", engagementId)
    .eq("workspace_id", workspace.workspace.id)
    .maybeSingle();
  const metadata = (engagement?.metadata && typeof engagement.metadata === "object" && !Array.isArray(engagement.metadata)
    ? engagement.metadata
    : {}) as Record<string, unknown>;
  const deadlineSchedule = (metadata.deadline_schedule && typeof metadata.deadline_schedule === "object"
    ? metadata.deadline_schedule
    : {}) as { items?: Array<{ authority?: string; extensionDate?: string | null; ruleStatus?: string }> };
  const calculated = deadlineSchedule.items?.filter((item) => item.ruleStatus === "calculated") ?? [];
  const extensionDueDate = calculated.find((item) => item.authority === "IRS")?.extensionDate
    ?? calculated.find((item) => item.extensionDate)?.extensionDate
    ?? null;
  const { error } = await supabase
    .from("tax_engagements")
    .update({ extension_requested: true, extension_filed: true, extension_due_date: extensionDueDate })
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
