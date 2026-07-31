"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { PortalSidebar } from "@/components/portal/PortalSidebar";
import { PortalHeader } from "@/components/portal/PortalHeader";
import { PortalBottomNav } from "@/components/portal/PortalBottomNav";
import { Toaster } from "@/components/ui/Toaster";
import type { ClientLink } from "@/lib/auth/portal";

export function PortalShell({
  client,
  links,
  userEmail,
  workspaceName,
  children,
}: {
  client: ClientLink;
  links: ClientLink[];
  userEmail: string;
  workspaceName: string;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden w-64 shrink-0 border-r border-border lg:block">
        <PortalSidebar workspaceName={workspaceName} />
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 shadow-xl">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
              aria-label="Close menu"
            >
              <X className="size-5" />
            </button>
            <PortalSidebar workspaceName={workspaceName} onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <PortalHeader
          client={client}
          links={links}
          userEmail={userEmail}
          onMenuClick={() => setDrawerOpen(true)}
        />
        <main className="flex-1 overflow-y-auto px-4 py-6 pb-20 sm:px-6 lg:px-8 lg:pb-6">
          {children}
        </main>
        <PortalBottomNav />
      </div>
      <Toaster />
    </div>
  );
}
