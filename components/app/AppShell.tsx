"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { AppSidebar } from "@/components/app/AppSidebar";
import { AppHeader } from "@/components/app/AppHeader";
import { Toaster } from "@/components/ui/LegacyToaster";
import type { WorkspaceContext } from "@/lib/auth/workspace";
import type { PermissionMap } from "@/lib/permissions/granular";
import { PermissionProvider } from "@/components/providers/permission-provider";

export function AppShell({
  workspace,
  memberships,
  userEmail,
  permissions,
  children,
}: {
  workspace: WorkspaceContext;
  memberships: WorkspaceContext[];
  userEmail: string;
  permissions: PermissionMap;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <PermissionProvider permissions={permissions}>
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
        <AppSidebar
          workspaceName={workspace.workspace.name}
          workspaceType={workspace.workspace.workspace_type}
          role={workspace.role}
        />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 shadow-xl">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            <AppSidebar
              workspaceName={workspace.workspace.name}
              workspaceType={workspace.workspace.workspace_type}
              role={workspace.role}
              onNavigate={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          workspace={workspace}
          memberships={memberships}
          userEmail={userEmail}
          onMenuClick={() => setDrawerOpen(true)}
        />
        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
    </PermissionProvider>
  );
}
