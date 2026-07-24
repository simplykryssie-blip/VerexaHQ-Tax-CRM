import type { LucideIcon } from "lucide-react";
import { Home, FileText, FolderOpen, ClipboardList, MessageCircleQuestion, MessagesSquare, UserRound } from "lucide-react";

export type PortalNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  { href: "/portal/dashboard", label: "Home", shortLabel: "Home", icon: Home },
  { href: "/portal/intakes", label: "Tax Intake", shortLabel: "Intake", icon: FileText },
  { href: "/portal/documents", label: "Documents", shortLabel: "Docs", icon: FolderOpen },
  { href: "/portal/document-requests", label: "Requests", shortLabel: "Requests", icon: ClipboardList },
  { href: "/portal/clarifications", label: "Clarifications", shortLabel: "Questions", icon: MessageCircleQuestion },
  { href: "/portal/messages", label: "Messages", shortLabel: "Messages", icon: MessagesSquare },
  { href: "/portal/profile", label: "Profile", shortLabel: "Profile", icon: UserRound },
];

/** Trimmed set for the mobile bottom bar — Documents/Requests share an icon slot via Documents, full list stays in the drawer. */
export const PORTAL_BOTTOM_NAV_ITEMS: PortalNavItem[] = [
  PORTAL_NAV_ITEMS[0],
  PORTAL_NAV_ITEMS[1],
  PORTAL_NAV_ITEMS[2],
  PORTAL_NAV_ITEMS[5],
  PORTAL_NAV_ITEMS[6],
];
