"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { createClient } from "@/lib/supabase/server";

export async function setEngagementStageAction(input: { engagementId: string; stageKey: string; reason?: string }) {
  const parsed = z.object({ engagementId: z.string().uuid(), stageKey: z.string().min(1).max(100), reason: z.string().trim().max(1000).optional() }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the workflow change." };
  const { workspace, user } = await requireWorkspace();
  if (!workspace) return { error: "No workspace is selected." };
  const supabase = await createClient();
  const { data: engagement } = await supabase.from("tax_engagements").select("created_by,primary_preparer_user_id,reviewer_user_id,responsible_staff_user_id").eq("id",parsed.data.engagementId).eq("workspace_id",workspace.workspace.id).maybeSingle();
  if (!engagement) return { error: "Engagement not found." };
  const context = { created_by: engagement.created_by, assigned_user_ids: [engagement.primary_preparer_user_id,engagement.reviewer_user_id,engagement.responsible_staff_user_id].filter(Boolean) };
  const { data: decision } = await supabase.rpc("check_permission", { p_workspace_id: workspace.workspace.id, p_permission_key: "engagements.advance", p_record_context: context });
  const allowed = decision && typeof decision === "object" && !Array.isArray(decision) && decision.allowed === true;
  if (!allowed) {
    const fallback = await requirePermission(workspace.workspace.id,"engagements.advance");
    return { error: decision && typeof decision === "object" && !Array.isArray(decision) && typeof decision.reason === "string" ? decision.reason : fallback.reason };
  }
  const { error } = await supabase.rpc("set_engagement_workflow_stage", { p_engagement_id: parsed.data.engagementId, p_stage_key: parsed.data.stageKey, p_reason: parsed.data.reason || undefined });
  if (error) return { error: error.message };
  revalidatePath("/engagements"); revalidatePath(`/engagements/${parsed.data.engagementId}`); revalidatePath("/work-queue");
  return { success: "Workflow stage updated.", actorId: user.id };
}
