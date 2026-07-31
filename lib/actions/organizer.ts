"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspaceRole, type WorkspaceContext } from "@/lib/auth/workspace";
import { requirePortalAccess } from "@/lib/auth/portal";
import { isIntakeEditable } from "@/lib/data/portal-intakes";
import { STAFF_ROLES, type MembershipRole } from "@/lib/types";
import { checkStatusTransition } from "@/lib/engagements/transitions";
import { changeStatusAction } from "@/lib/actions/engagements";
import {
  assignOrganizerSchema,
  rolloverOrganizerSchema,
  sendReminderSchema,
  updateCurrentSectionSchema,
  confirmRolledForwardSchema,
  createOrganizerTemplateSchema,
  type AssignOrganizerInput,
  type RolloverOrganizerInput,
  type SendReminderInput,
  type CreateOrganizerTemplateInput,
} from "@/lib/validation/organizer";
import type { Json } from "@/types/database";

type ActionResult = { error?: string; success?: true; submissionId?: string; templateId?: string };

async function guard(allowedRoles: MembershipRole[]) {
  const { allowed, workspace } = await requireWorkspaceRole(allowedRoles);
  if (!allowed || !workspace) {
    return { ok: false as const, error: "You don't have permission to do this in this workspace." };
  }
  return { ok: true as const, workspace: workspace as WorkspaceContext };
}

/**
 * Picks the best-fit organizer template for an engagement's return/engagement
 * type, using the metadata already stamped on each templates row at seed
 * time (tax_form / engagement_type) — no separate mapping table needed.
 */
export async function recommendTemplate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  returnType: string | null,
  engagementType: string,
) {
  const { data } = await supabase
    .from("templates")
    .select("id, metadata, workspace_id")
    .eq("kind", "form")
    .eq("status", "published")
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`);

  const candidates = data ?? [];
  const byReturnType = returnType
    ? candidates.find((t) => (t.metadata as Record<string, unknown>)?.tax_form === returnType)
    : undefined;
  if (byReturnType) return byReturnType.id;

  const byEngagementType = candidates.find(
    (t) => (t.metadata as Record<string, unknown>)?.engagement_type === engagementType,
  );
  return byEngagementType?.id ?? null;
}

export async function listOrganizerTemplateOptions() {
  const guarded = await guard(STAFF_ROLES);
  if (!guarded.ok) return [];

  const supabase = await createClient();
  const { data } = await supabase
    .from("templates")
    .select("id, name, status, metadata, workspace_id")
    .eq("kind", "form")
    .neq("status", "archived")
    .or(`workspace_id.is.null,workspace_id.eq.${guarded.workspace.workspace.id}`)
    .order("name");

  return data ?? [];
}

export async function assignOrganizerAction(input: AssignOrganizerInput): Promise<ActionResult> {
  const guarded = await guard(STAFF_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const parsed = assignOrganizerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const data = parsed.data;
  const workspaceId = guarded.workspace.workspace.id;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: engagement, error: engagementError } = await supabase
    .from("tax_engagements")
    .select("id, client_id, tax_year, engagement_type, return_type, status, due_date")
    .eq("id", data.engagementId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (engagementError || !engagement) return { error: "Engagement not found." };

  const { data: existing } = await supabase
    .from("intake_submissions")
    .select("id")
    .eq("engagement_id", data.engagementId)
    .neq("status", "archived")
    .maybeSingle();

  if (existing) {
    return { error: "This engagement already has an active organizer. Archive it first to create another." };
  }

  const templateId =
    data.templateId ??
    (await recommendTemplate(supabase, workspaceId, engagement.return_type, engagement.engagement_type));

  if (!templateId) return { error: "No matching organizer template was found for this engagement." };

  const { data: template } = await supabase
    .from("templates")
    .select("id, current_version_id")
    .eq("id", templateId)
    .maybeSingle();

  if (!template?.current_version_id) return { error: "This template has no usable version." };

  const { data: submission, error } = await supabase
    .from("intake_submissions")
    .insert({
      workspace_id: workspaceId,
      client_id: engagement.client_id,
      engagement_id: data.engagementId,
      template_id: templateId,
      template_version_id: template.current_version_id,
      tax_year: engagement.tax_year,
      due_date: data.dueDate || engagement.due_date || null,
      assigned_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error || !submission) return { error: "We couldn't assign the organizer. Please try again." };

  // Part 12: assigning an organizer may move a draft engagement to
  // awaiting_client — never overriding a more advanced status.
  if (checkStatusTransition(engagement.status, "awaiting_client").allowed) {
    await changeStatusAction({ engagementId: data.engagementId, status: "awaiting_client" });
  }

  await supabase.from("notifications").insert({
    workspace_id: workspaceId,
    client_id: engagement.client_id,
    type: "organizer_assigned",
    title: "Your tax organizer is ready",
    message: "Your tax office has assigned you a tax organizer to complete. Sign in to your portal to get started.",
  });

  revalidatePath(`/engagements/${data.engagementId}`);
  revalidatePath(`/engagements/${data.engagementId}/organizer`);
  return { success: true, submissionId: submission.id };
}

/**
 * What "identity" fields are safe to carry forward per repeatable-entity
 * type (Part 8): labels and identifying details, never amounts. Anything
 * not covered by an allowlist below falls back to display_name only.
 */
const ROLLOVER_DATA_ALLOWLIST: Record<string, string[]> = {
  employer: ["employer_name"],
  business: ["business_name", "business_type"],
  rental_property: ["address", "description"],
  k1_entity: ["entity_name"],
  vehicle: ["vehicle_description", "make", "model", "year"],
  bank_account: ["bank_name", "account_type"],
  business_owner: ["owner_name", "role_title"],
  state_filing: ["state"],
  foreign_account: ["institution_name", "country"],
  digital_asset_account: ["platform_name"],
};

function pickRolloverData(entityType: string, data: Record<string, unknown> | null): Json {
  if (!data) return {} as Json;
  const allowlist = ROLLOVER_DATA_ALLOWLIST[entityType];
  if (!allowlist) return {} as Json;
  const picked: Record<string, unknown> = {};
  for (const key of allowlist) {
    if (data[key] !== undefined) picked[key] = data[key];
  }
  return picked as Json;
}

export async function rolloverOrganizerAction(input: RolloverOrganizerInput): Promise<ActionResult> {
  const guarded = await guard(STAFF_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const parsed = rolloverOrganizerSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input." };
  const data = parsed.data;
  const workspaceId = guarded.workspace.workspace.id;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: source, error: sourceError } = await supabase
    .from("intake_submissions")
    .select("id, client_id, template_id")
    .eq("id", data.sourceSubmissionId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (sourceError || !source) return { error: "Prior-year organizer not found." };

  const { data: engagement, error: engagementError } = await supabase
    .from("tax_engagements")
    .select("id, client_id, tax_year, due_date, status")
    .eq("id", data.engagementId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (engagementError || !engagement) return { error: "Engagement not found." };

  const { data: existing } = await supabase
    .from("intake_submissions")
    .select("id")
    .eq("engagement_id", data.engagementId)
    .neq("status", "archived")
    .maybeSingle();

  if (existing) return { error: "This engagement already has an active organizer." };

  const { data: template } = await supabase
    .from("templates")
    .select("id, current_version_id, latest_published_version_id")
    .eq("id", source.template_id)
    .maybeSingle();

  const templateVersionId = template?.latest_published_version_id ?? template?.current_version_id;
  if (!templateVersionId) return { error: "This template has no usable version." };

  const { data: submission, error } = await supabase
    .from("intake_submissions")
    .insert({
      workspace_id: workspaceId,
      client_id: engagement.client_id,
      engagement_id: data.engagementId,
      template_id: source.template_id,
      template_version_id: templateVersionId,
      tax_year: engagement.tax_year,
      due_date: engagement.due_date,
      assigned_by: user?.id ?? null,
      source_submission_id: data.sourceSubmissionId,
    })
    .select("id")
    .single();

  if (error || !submission) return { error: "We couldn't create the organizer. Please try again." };

  const [householdResult, entitiesResult] = await Promise.all([
    supabase.from("intake_household_people").select("*").eq("submission_id", data.sourceSubmissionId),
    supabase.from("intake_repeatable_entities").select("*").eq("submission_id", data.sourceSubmissionId),
  ]);

  for (const person of householdResult.data ?? []) {
    await supabase.from("intake_household_people").insert({
      submission_id: submission.id,
      workspace_id: workspaceId,
      household_member_id: person.household_member_id,
      person_role: person.person_role,
      first_name: person.first_name,
      middle_name: person.middle_name,
      last_name: person.last_name,
      suffix: person.suffix,
      date_of_birth: person.date_of_birth,
      ssn_last4: person.ssn_last4,
      relationship: person.relationship,
      occupation: person.occupation,
      rolled_forward: true,
      confirmed_by_client: false,
    });
  }

  for (const entity of entitiesResult.data ?? []) {
    await supabase.from("intake_repeatable_entities").insert({
      submission_id: submission.id,
      workspace_id: workspaceId,
      entity_type: entity.entity_type,
      display_name: entity.display_name,
      data: pickRolloverData(entity.entity_type, entity.data as Record<string, unknown> | null),
      is_complete: false,
      rolled_forward: true,
      confirmed_by_client: false,
      created_by: user?.id ?? null,
    });
  }

  if (checkStatusTransition(engagement.status, "awaiting_client").allowed) {
    await changeStatusAction({ engagementId: data.engagementId, status: "awaiting_client" });
  }

  await supabase.from("notifications").insert({
    workspace_id: workspaceId,
    client_id: engagement.client_id,
    type: "organizer_assigned",
    title: "Your tax organizer is ready",
    message:
      "We've carried forward some information from last year. Please review it and complete the rest of your organizer.",
  });

  revalidatePath(`/engagements/${data.engagementId}`);
  revalidatePath(`/engagements/${data.engagementId}/organizer`);
  return { success: true, submissionId: submission.id };
}

export async function sendOrganizerReminderAction(input: SendReminderInput): Promise<ActionResult> {
  const guarded = await guard(STAFF_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const parsed = sendReminderSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const workspaceId = guarded.workspace.workspace.id;

  const supabase = await createClient();
  const { data: submission } = await supabase
    .from("intake_submissions")
    .select("id, client_id, engagement_id")
    .eq("id", parsed.data.submissionId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (!submission) return { error: "Organizer not found." };

  const { error } = await supabase.from("notifications").insert({
    workspace_id: workspaceId,
    client_id: submission.client_id,
    type: "organizer_reminder",
    title: "Reminder: complete your tax organizer",
    message: parsed.data.message,
  });

  if (error) return { error: "We couldn't send the reminder." };

  if (submission.engagement_id) revalidatePath(`/engagements/${submission.engagement_id}/organizer`);
  return { success: true };
}

export async function updateCurrentSectionAction(submissionId: string, sectionId: string): Promise<ActionResult> {
  const parsed = updateCurrentSectionSchema.safeParse({ submissionId, sectionId });
  if (!parsed.success) return { error: "Invalid input." };

  const { client } = await requirePortalAccess();
  if (!client) return { error: "No linked client account." };

  const supabase = await createClient();
  const { data: submission } = await supabase
    .from("intake_submissions")
    .select("id, status, locked_at")
    .eq("id", parsed.data.submissionId)
    .eq("client_id", client.client.id)
    .maybeSingle();

  if (!submission || !isIntakeEditable(submission as never)) return { error: "Organizer not found." };

  await supabase
    .from("intake_submissions")
    .update({ current_section_id: parsed.data.sectionId })
    .eq("id", parsed.data.submissionId);

  return { success: true };
}

const DOCUMENT_RULE_STATUSES = ["not_applicable", "unavailable", "will_provide_later"] as const;

/**
 * Records a client's "I don't have this" / "Not applicable" / "I'll provide
 * later" response to an organizer document rule. There's no per-rule
 * response table for this (document rules only drive the real,
 * staff-generated document_requests) — reusing intake_submissions.metadata
 * (already a generic jsonb column) avoids adding a new table for what is
 * a small, per-submission map.
 */
export async function markDocumentRuleStatusAction(
  submissionId: string,
  ruleId: string,
  status: (typeof DOCUMENT_RULE_STATUSES)[number],
): Promise<ActionResult> {
  if (!DOCUMENT_RULE_STATUSES.includes(status)) return { error: "Invalid status." };

  const { client } = await requirePortalAccess();
  if (!client) return { error: "No linked client account." };

  const supabase = await createClient();
  const { data: submission } = await supabase
    .from("intake_submissions")
    .select("id, metadata")
    .eq("id", submissionId)
    .eq("client_id", client.client.id)
    .maybeSingle();

  if (!submission) return { error: "Organizer not found." };

  const metadata = (submission.metadata as Record<string, unknown>) ?? {};
  const documentRuleStatus = (metadata.document_rule_status as Record<string, string>) ?? {};
  documentRuleStatus[ruleId] = status;

  const { error } = await supabase
    .from("intake_submissions")
    .update({ metadata: { ...metadata, document_rule_status: documentRuleStatus } as Json })
    .eq("id", submissionId);

  if (error) return { error: "We couldn't save that. Please try again." };

  revalidatePath(`/portal/organizer/${submissionId}`);
  return { success: true };
}

export async function confirmRolledForwardAction(
  kind: "answer" | "household" | "entity",
  id: string,
  submissionId: string,
): Promise<ActionResult> {
  const parsed = confirmRolledForwardSchema.safeParse({ kind, id, submissionId });
  if (!parsed.success) return { error: "Invalid input." };

  const { client } = await requirePortalAccess();
  if (!client) return { error: "No linked client account." };

  const supabase = await createClient();
  const { data: submission } = await supabase
    .from("intake_submissions")
    .select("id")
    .eq("id", parsed.data.submissionId)
    .eq("client_id", client.client.id)
    .maybeSingle();

  if (!submission) return { error: "Organizer not found." };

  const table =
    parsed.data.kind === "answer"
      ? "intake_answers"
      : parsed.data.kind === "household"
        ? "intake_household_people"
        : "intake_repeatable_entities";

  const { error } = await supabase
    .from(table)
    .update({ confirmed_by_client: true })
    .eq("id", parsed.data.id)
    .eq("submission_id", parsed.data.submissionId);

  if (error) return { error: "We couldn't confirm this item." };

  revalidatePath(`/portal/organizer/${parsed.data.submissionId}`);
  return { success: true };
}

// --- Template management (Part 14/15) — thin wrappers over the existing
// generic templates system's RPCs, scoped to kind='form'. ---

export async function createOrganizerTemplateAction(input: CreateOrganizerTemplateInput): Promise<ActionResult> {
  const guarded = await guard(STAFF_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const parsed = createOrganizerTemplateSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_template_draft", {
    p_workspace_id: guarded.workspace.workspace.id,
    p_kind: "form",
    p_name: parsed.data.name,
    p_description: parsed.data.description,
    p_category: parsed.data.category ?? "Tax Organizer",
    p_visibility: "workspace",
  });

  if (error || !data) return { error: "We couldn't create this template." };

  revalidatePath("/settings/organizers");
  return { success: true, templateId: data };
}

export async function cloneOrganizerTemplateAction(templateId: string): Promise<ActionResult> {
  const guarded = await guard(STAFF_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const supabase = await createClient();
  const { data: source } = await supabase.from("templates").select("name").eq("id", templateId).maybeSingle();
  if (!source) return { error: "Template not found." };

  const { data, error } = await supabase.rpc("duplicate_template", {
    p_source_template_id: templateId,
    p_target_workspace_id: guarded.workspace.workspace.id,
    p_new_name: `${source.name} (copy)`,
  });

  if (error || !data) return { error: "We couldn't clone this template." };

  revalidatePath("/settings/organizers");
  return { success: true, templateId: data };
}

/**
 * Toggles a template between published/archived (Part 15's
 * "activate/deactivate"). Scoped to templates this workspace owns
 * (workspace_id = workspace) — global system templates (workspace_id
 * null) are shared across every workspace, so they're clone-only here,
 * never directly archived by one tenant.
 */
export async function setOrganizerTemplateStatusAction(
  templateId: string,
  status: "published" | "archived",
): Promise<ActionResult> {
  const guarded = await guard(STAFF_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const supabase = await createClient();
  const { data: template } = await supabase
    .from("templates")
    .select("id, workspace_id, current_version_id")
    .eq("id", templateId)
    .eq("workspace_id", guarded.workspace.workspace.id)
    .maybeSingle();

  if (!template) return { error: "You can only activate or deactivate templates your workspace owns." };
  if (status === "published" && !template.current_version_id) {
    return { error: "This template has no published version yet." };
  }

  const { error } = await supabase
    .from("templates")
    .update({ status, archived_at: status === "archived" ? new Date().toISOString() : null })
    .eq("id", templateId);

  if (error) return { error: "We couldn't update this template." };

  revalidatePath("/settings/organizers");
  revalidatePath(`/settings/organizers/${templateId}`);
  return { success: true };
}

export async function publishOrganizerTemplateVersionAction(
  templateId: string,
  versionId: string,
): Promise<ActionResult> {
  const guarded = await guard(STAFF_ROLES);
  if (!guarded.ok) return { error: guarded.error };

  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_template_version", {
    p_template_id: templateId,
    p_version_id: versionId,
  });

  if (error) return { error: "We couldn't publish this version." };

  revalidatePath("/settings/organizers");
  revalidatePath(`/settings/organizers/${templateId}`);
  return { success: true };
}
