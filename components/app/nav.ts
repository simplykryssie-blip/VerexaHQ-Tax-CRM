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
  WalletCards,
  Users,
} from "lucide-react";
import type { MembershipRole, Workspace } from "@/lib/types";
import { roleHasCapability } from "@/lib/permissions/capabilities";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permissionKey?: string;
};

const CORE_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permissionKey: "dashboard.view" },
  { href: "/clients", label: "Clients", icon: Users, permissionKey: "clients.view" },
  { href: "/engagements", label: "Engagements", icon: ClipboardList, permissionKey: "engagements.view" },
  { href: "/intakes", label: "Intakes", icon: FileText, permissionKey: "intakes.view" },
  { href: "/document-requests", label: "Document Requests", icon: FolderOpen, permissionKey: "documents.view" },
];

export function navItemsForWorkspace(
  workspaceType: Workspace["workspace_type"],
  role: MembershipRole,
): NavItem[] {
  const items: NavItem[] = [...CORE_NAV_ITEMS, { href: "/work-queue", label: "Work Queue", icon: ListChecks, permissionKey: "tasks.view" }];

  if (roleHasCapability(role, "review_returns")) {
    items.push({ href: "/ero-review", label: "ERO Review", icon: ClipboardCheck, permissionKey: "reviews.view" });
  }

  if (["owner", "admin"].includes(role) && workspaceType !== "independent_ptin") {
    items.push({ href: "/relationships", label: "Office Relationships", icon: Building2 });
  }

  if (["owner", "admin", "ero"].includes(role)) {
    items.push({ href: "/services", label: "Services & Engagement Types", icon: WalletCards, permissionKey: "service_packages.view" });
    items.push({ href: "/settings", label: "Settings", icon: Settings, permissionKey: "settings.manage" });
  }

  return items;
}
