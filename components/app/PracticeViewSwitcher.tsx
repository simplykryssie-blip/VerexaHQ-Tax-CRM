"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, Building2, Network } from "lucide-react";
import {
  PRACTICE_VIEW_HOME,
  PRACTICE_VIEW_LABELS,
  practiceViewsForWorkspace,
} from "@/lib/practice-views";
import type { MembershipRole, Workspace } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS = {
  ptin: BriefcaseBusiness,
  ero: Building2,
  service_bureau: Network,
};

export function PracticeViewSwitcher({
  workspaceType,
  role,
  onNavigate,
}: {
  workspaceType: Workspace["workspace_type"];
  role: MembershipRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const views = practiceViewsForWorkspace(workspaceType, role);

  if (views.length <= 1) return null;

  return (
    <div className="border-b border-border px-3 py-3">
      <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted">
        Working view
      </p>
      <div className="mt-2 space-y-1">
        {views.map((view) => {
          const href = PRACTICE_VIEW_HOME[view];
          const Icon = ICONS[view];
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={view}
              href={href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium",
                active ? "bg-accent-50 text-accent-700" : "text-slate-600 hover:bg-slate-50",
              )}
            >
              <Icon className="size-4" />
              {PRACTICE_VIEW_LABELS[view]}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
