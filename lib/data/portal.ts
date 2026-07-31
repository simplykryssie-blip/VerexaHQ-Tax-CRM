import type { SupabaseServerClient } from "@/lib/supabase/server";

export async function getWorkspaceName(
  supabase: SupabaseServerClient,
  workspaceId: string,
): Promise<string> {
  const { data } = await supabase
    .from("workspaces")
    .select("name")
    .eq("id", workspaceId)
    .maybeSingle();

  return data?.name ?? "Your tax office";
}
