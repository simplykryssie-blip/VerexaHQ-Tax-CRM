import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderOpen,
  LayoutDashboard,
  ListChecks,
  Settings,
  Users,
} from "lucide-react";
import type { MembershipRole, Workspace } from "@/lib/types";
import { roleHasCapability } from "@/lib/permissions/capabilities";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const CORE_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/engagements", label: "Engagements", icon: ClipboardList },
  { href: "/intakes", label: "Intakes", icon: FileText },
  { href: "/document-requests", label: "Document Requests", icon: FolderOpen },
];

export function navItemsForWorkspace(
  workspaceType: Workspace["workspace_type"],
  role: MembershipRole,
): NavItem[] {
  const items = [...CORE_NAV_ITEMS, { href: "/work-queue", label: "Work Queue", icon: ListChecks }];

  if (roleHasCapability(role, "review_returns")) {
    items.push({ href: "/ero-review", label: "ERO Review", icon: ClipboardCheck });
  }

  if (["owner", "admin"].includes(role) && workspaceType !== "independent_ptin") {
    items.push({ href: "/relationships", label: "Office Relationships", icon: Building2 });
  }

  if (["owner", "admin", "ero"].includes(role)) {
    items.push({ href: "/settings", label: "Settings", icon: Settings });
  }

  return items;
}
