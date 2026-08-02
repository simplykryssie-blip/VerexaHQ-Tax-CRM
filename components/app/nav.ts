import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Settings,
  WalletCards,
  BadgeDollarSign,
  Users,
  UsersRound,
  FileInput,
  FileCheck2,
  Home,
  CalendarDays,
  MessagesSquare,
  PenTool,
  Receipt,
  Workflow,
  LayoutTemplate,
  BarChart3,
  UserCog,
  Plug,
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
  { href: "/leads", label: "Leads", icon: UsersRound, permissionKey: "leads.view" },
  { href: "/lead-forms", label: "Lead Forms", icon: FileInput, permissionKey: "lead_forms.manage" },
  { href: "/clients", label: "Clients", icon: Users, permissionKey: "clients.view" },
  { href: "/households", label: "Households", icon: Home, permissionKey: "clients.view" },
  { href: "/engagements", label: "Engagements", icon: ClipboardList, permissionKey: "engagements.view" },
  { href: "/pricing", label: "Pricing & Quotes", icon: BadgeDollarSign, permissionKey: "pricing.view" },
  { href: "/intakes", label: "Intakes", icon: FileText, permissionKey: "intakes.view" },
  { href: "/document-requests", label: "Document Requests", icon: Inbox, permissionKey: "documents.view" },
  { href: "/documents", label: "Document Vault", icon: FolderOpen, permissionKey: "documents.view" },
  { href: "/communications", label: "Communications", icon: MessagesSquare, permissionKey: "communications.view" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, permissionKey: "appointments.view" },
  { href: "/signatures", label: "Signatures", icon: PenTool, permissionKey: "signatures.view" },
  { href: "/review-release", label: "Review & Release", icon: FileCheck2, permissionKey: "reviews.view" },
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
    items.push({ href: "/billing", label: "Billing", icon: Receipt, permissionKey: "billing.manage" });
    items.push({ href: "/templates", label: "Templates & Forms", icon: LayoutTemplate, permissionKey: "templates.manage" });
    items.push({ href: "/workflows", label: "Automations", icon: Workflow, permissionKey: "automation.view" });
    items.push({ href: "/reports", label: "Reports", icon: BarChart3, permissionKey: "reports.view" });
    items.push({ href: "/team", label: "Team", icon: UserCog, permissionKey: "team.manage" });
    items.push({ href: "/services", label: "Services & Packages", icon: WalletCards, permissionKey: "service_packages.view" });
    items.push({ href: "/settings/integrations", label: "Integrations", icon: Plug, permissionKey: "integrations.manage" });
    items.push({ href: "/settings", label: "Settings", icon: Settings, permissionKey: "settings.manage" });
  }

  return items;
}
