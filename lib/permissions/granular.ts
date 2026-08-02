import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type PermissionScope = "assigned" | "team" | "workspace";

export type PermissionGrant = {
  key: string;
  allowed: boolean;
  scope: PermissionScope;
  denialReason: string | null;
};

export type PermissionMap = Record<string, PermissionGrant>;

export const getMyPermissions = cache(async (workspaceId: string): Promise<PermissionMap> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_permissions", { p_workspace_id: workspaceId });
  if (error || !data) return {};

  return Object.fromEntries(
    data.map((row) => [
      row.permission_key,
      {
        key: row.permission_key,
        allowed: row.allowed,
        scope: row.permission_scope as PermissionScope,
        denialReason: row.denial_reason,
      },
    ]),
  );
});

export async function requirePermission(workspaceId: string, permissionKey: string) {
  const permissions = await getMyPermissions(workspaceId);
  const grant = permissions[permissionKey];
  return {
    allowed: grant?.allowed ?? false,
    scope: grant?.scope ?? "workspace",
    reason: grant?.denialReason ?? "Your role does not include this permission.",
  } as const;
}
