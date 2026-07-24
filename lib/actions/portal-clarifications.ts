"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePortalAccess } from "@/lib/auth/portal";
import {
  respondToClarificationSchema,
  type RespondToClarificationInput,
} from "@/lib/validation/portal-clarifications";

type ActionResult = { error?: string; success?: true };

export async function respondToClarificationAction(
  input: RespondToClarificationInput,
): Promise<ActionResult> {
  const parsed = respondToClarificationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { client, user } = await requirePortalAccess();
  if (!client) return { error: "No linked client account." };

  const supabase = await createClient();

  // Ownership is verified explicitly against the resolved client id — never
  // trusted from the submission id alone.
  const { data: submission } = await supabase
    .from("intake_submissions")
    .select("id, workspace_id")
    .eq("client_id", client.client.id)
    .eq("id", parsed.data.submissionId)
    .maybeSingle();

  if (!submission) return { error: "Intake not found." };

  // A client can only ever post a new, unresolved, self-authored,
  // client-visible reply — resolving a clarification remains exclusively a
  // staff action via resolve_intake_clarification(), enforced by RLS
  // (intake_review_comments_client_reply), not just by this action.
  const { error } = await supabase.from("intake_review_comments").insert({
    submission_id: parsed.data.submissionId,
    workspace_id: submission.workspace_id,
    field_id: parsed.data.fieldId,
    comment: parsed.data.comment,
    is_client_visible: true,
    created_by: user.id,
  });

  if (error) return { error: "We couldn't send your response. Please try again." };

  revalidatePath("/portal/clarifications");
  return { success: true };
}
