import type { SupabaseServerClient } from "@/lib/supabase/server";

export type UserSummary = { userId: string; name: string };

/**
 * intake_submissions / document_requests / review tables store raw
 * auth.users IDs (assigned_by, reviewed_by, created_by, etc.) with no
 * declared foreign key to user_profiles, so PostgREST can't embed the
 * profile in a nested select — this looks names up in a single extra query.
 */
export async function getUserSummaryMap(
  supabase: SupabaseServerClient,
  userIds: (string | null | undefined)[],
): Promise<Map<string, UserSummary>> {
  const ids = Array.from(new Set(userIds.filter((id): id is string => Boolean(id))));
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, display_name, first_name, last_name")
    .in("id", ids);

  const map = new Map<string, UserSummary>();
  if (error || !data) return map;

  for (const profile of data) {
    const name =
      profile.display_name ||
      [profile.first_name, profile.last_name].filter(Boolean).join(" ") ||
      "Staff member";
    map.set(profile.id, { userId: profile.id, name });
  }
  return map;
}

/** Active workspace members with a resolved display name, for reviewer/assignee pickers. */
export async function listWorkspaceStaff(
  supabase: SupabaseServerClient,
  workspaceId: string,
): Promise<UserSummary[]> {
  const { data, error } = await supabase
    .from("workspace_users")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("status", "active");

  if (error || !data) return [];

  const userIds = data.map((m) => m.user_id);
  const map = await getUserSummaryMap(supabase, userIds);
  return userIds.map((id) => map.get(id) ?? { userId: id, name: "Staff member" });
}
