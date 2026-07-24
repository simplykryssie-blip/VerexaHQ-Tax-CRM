"use client";

import { Menu } from "lucide-react";
import { WorkspaceSwitcher } from "@/components/app/WorkspaceSwitcher";
import { SignOutButton } from "@/components/app/SignOutButton";
import { initials, titleCase } from "@/lib/utils";
import type { WorkspaceContext } from "@/lib/auth/workspace";

export function AppHeader({
  workspace,
  memberships,
  userEmail,
  onMenuClick,
}: {
  workspace: WorkspaceContext;
  memberships: WorkspaceContext[];
  userEmail: string;
  onMenuClick: () => void;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" />
        </button>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-foreground">{workspace.workspace.name}</p>
          <p className="text-xs text-muted">{titleCase(workspace.role)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <WorkspaceSwitcher
          memberships={memberships}
          currentWorkspaceId={workspace.workspace.id}
        />
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-full bg-accent-100 text-xs font-semibold text-accent-700">
            {initials(userEmail)}
          </div>
          <span className="hidden max-w-40 truncate text-sm text-foreground md:inline">
            {userEmail}
          </span>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
