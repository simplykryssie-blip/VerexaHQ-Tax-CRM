"use client";

import { Menu } from "lucide-react";
import { PortalClientSwitcher } from "@/components/portal/PortalClientSwitcher";
import { SignOutButton } from "@/components/app/SignOutButton";
import { initials, clientDisplayName } from "@/lib/utils";
import type { ClientLink } from "@/lib/auth/portal";

export function PortalHeader({
  client,
  links,
  userEmail,
  onMenuClick,
}: {
  client: ClientLink;
  links: ClientLink[];
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
          <p className="text-sm font-medium text-foreground">{clientDisplayName(client.client)}</p>
          <p className="text-xs text-muted">Client Portal</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <PortalClientSwitcher links={links} currentClientId={client.client.id} />
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
