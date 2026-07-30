import { createClient } from "@/lib/supabase/client";

/** Submits one or more engagements for ERO review — the same insert
 * whether it's a single "Send for review" click or a bulk-selected batch,
 * the RLS policy on ero_reviews independently verifies ero_workspace_id
 * is a real, active, correctly-typed relationship (not just trusting
 * whatever the client sends). */
export async function sendEngagementsForEroReview(engagementIds: string[], ptinWorkspaceId: string, eroWorkspaceId: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("ero_reviews").insert(
    engagementIds.map((engagement_id) => ({
      engagement_id,
      ptin_workspace_id: ptinWorkspaceId,
      ero_workspace_id: eroWorkspaceId,
      status: "pending_review" as const,
      submitted_by: user?.id ?? null,
    })),
  );
  if (error) throw new Error(error.message);
}
