"use client";

import { useTransition } from "react";
import { switchWorkspaceAction } from "@/lib/actions/workspace";
import type { WorkspaceContext } from "@/lib/auth/workspace";
import { selectClassName } from "@/components/ui/FilterBar";

export function WorkspaceSwitcher({
  memberships,
  currentWorkspaceId,
}: {
  memberships: WorkspaceContext[];
  currentWorkspaceId: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (memberships.length <= 1) return null;

  return (
    <select
      defaultValue={currentWorkspaceId}
      disabled={isPending}
      onChange={(event) => {
        const formData = new FormData();
        formData.set("workspaceId", event.target.value);
        startTransition(() => switchWorkspaceAction(formData));
      }}
      className={selectClassName}
      aria-label="Switch workspace"
    >
      {memberships.map((m) => (
        <option key={m.workspace.id} value={m.workspace.id}>
          {m.workspace.name}
        </option>
      ))}
    </select>
  );
}
