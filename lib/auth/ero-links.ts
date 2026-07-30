import { createClient } from "@/lib/supabase/server";

export type LinkedEroWorkspace = { relationshipId: string; workspaceId: string; name: string };

/** The active ERO/service-bureau this workspace is linked to, if any —
 * null for a fully independent PTIN holder with no oversight relationship.
 * Resolved via a SECURITY DEFINER RPC rather than a plain embedded select:
 * a PTIN holder can't SELECT the ERO's own workspace row (and vice versa)
 * under workspaces_select RLS, so a direct join always came back null. */
export async function getLinkedEroWorkspace(workspaceId: string): Promise<LinkedEroWorkspace | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_linked_ero_workspace", { p_workspace_id: workspaceId });
  const row = data?.[0];
  if (!row) return null;
  return { relationshipId: row.relationship_id, workspaceId: row.workspace_id, name: row.name };
}
