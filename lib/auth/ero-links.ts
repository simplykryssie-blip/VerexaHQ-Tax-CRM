import { createClient } from "@/lib/supabase/server";

export type LinkedEroWorkspace = { relationshipId: string; workspaceId: string; name: string };

/** The active ERO/service-bureau this workspace is linked to, if any —
 * null for a fully independent PTIN holder with no oversight relationship. */
export async function getLinkedEroWorkspace(workspaceId: string): Promise<LinkedEroWorkspace | null> {
  const supabase = await createClient();
  const { data: relationships } = await supabase
    .from("workspace_relationships")
    .select("id, source_workspace_id, target_workspace_id, source:workspaces!workspace_relationships_source_workspace_id_fkey(id, name, workspace_type), target:workspaces!workspace_relationships_target_workspace_id_fkey(id, name, workspace_type)")
    .eq("status", "active")
    .in("relationship_type", ["ptin_to_ero", "service_bureau_to_ero"])
    .or(`source_workspace_id.eq.${workspaceId},target_workspace_id.eq.${workspaceId}`);

  for (const r of relationships ?? []) {
    const other = r.source_workspace_id === workspaceId ? r.target : r.source;
    const otherRow = other as unknown as { id: string; name: string; workspace_type: string } | null;
    if (otherRow && (otherRow.workspace_type === "ero_office" || otherRow.workspace_type === "service_bureau")) {
      return { relationshipId: r.id, workspaceId: otherRow.id, name: otherRow.name };
    }
  }
  return null;
}
