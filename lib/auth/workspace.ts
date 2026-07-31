import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser, requireAuthUser } from "@/lib/auth/session";
import type { MembershipRole, Workspace } from "@/lib/types";

export const WORKSPACE_COOKIE = "verexa-workspace-id";

export type WorkspaceContext = {
  workspace: Workspace;
  role: MembershipRole;
  membershipId: string;
};

// Older workspace chooser screens use this name for the same resolved
// membership shape.
export type WorkspaceMembership = WorkspaceContext;

/**
 * All workspaces the current user belongs to as an active member. This is the
 * only source of truth for "which workspaces can this user see" — never a
 * client-supplied ID.
 */
export const listMyWorkspaces = cache(async (): Promise<WorkspaceContext[]> => {
  const user = await getAuthUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id, role, workspace:workspaces(*)")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error || !data) {
    return [];
  }

  return data
    .filter(
      (member): member is typeof member & { workspace: Workspace } =>
        Boolean(member.workspace),
    )
    .map((member) => ({
      workspace: member.workspace,
      role: member.role,
      membershipId: member.id,
    }));
});

/**
 * Resolves the "current" workspace for this request: the workspace named by
 * the verexa-workspace-id cookie IF the user is still an active member of it,
 * otherwise the user's first active membership. Never trusts a workspace ID
 * read from a URL/query param.
 */
export const getCurrentWorkspace = cache(
  async (): Promise<WorkspaceContext | null> => {
    const memberships = await listMyWorkspaces();
    if (memberships.length === 0) return null;

    const cookieStore = await cookies();
    const preferredId = cookieStore.get(WORKSPACE_COOKIE)?.value;

    const preferred = preferredId
      ? memberships.find((m) => m.workspace.id === preferredId)
      : undefined;

    return preferred ?? memberships[0];
  },
);

export type RequireWorkspaceResult = {
  user: NonNullable<Awaited<ReturnType<typeof requireAuthUser>>>;
  workspace: WorkspaceContext | null;
  memberships: WorkspaceContext[];
};

/** Authenticated user + their resolved current workspace (null if they belong to none). */
export async function requireWorkspace(): Promise<RequireWorkspaceResult> {
  const user = await requireAuthUser();
  const [workspace, memberships] = await Promise.all([
    getCurrentWorkspace(),
    listMyWorkspaces(),
  ]);
  return { user, workspace, memberships };
}

export type RequireRoleResult = RequireWorkspaceResult & { allowed: boolean };

/**
 * Authenticated user + current workspace, plus whether their role in that
 * workspace is one of `allowedRoles`. Callers must check `.allowed` and
 * render a ForbiddenState (or redirect) themselves — this never throws, so
 * pages can render a friendly message instead of a hard crash.
 */
export async function requireWorkspaceRole(
  allowedRoles: MembershipRole[],
): Promise<RequireRoleResult> {
  const result = await requireWorkspace();
  const allowed = Boolean(
    result.workspace && allowedRoles.includes(result.workspace.role),
  );
  return { ...result, allowed };
}

/**
 * Server-side membership check for a specific workspace ID, used as a second
 * layer of defense on top of RLS before trusting any workspace-scoped write.
 * Calls the database's own is_workspace_member() function rather than
 * re-implementing that logic in application code.
 */
export async function assertWorkspaceMember(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_workspace_member", {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
  return data === true;
}
