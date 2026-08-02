import type { LucideIcon } from "lucide-react";
import { Home, FileText, FolderOpen, ClipboardList, MessageCircleQuestion, MessagesSquare, UserRound, Briefcase, BadgeDollarSign, CalendarDays, PenTool, Receipt, FileCheck2, Bell } from "lucide-react";

export type PortalNavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  { href: "/portal/dashboard", label: "Home", shortLabel: "Home", icon: Home },
  { href: "/portal/engagements", label: "Engagements", shortLabel: "Engagements", icon: Briefcase },
  { href: "/portal/quotes", label: "Quotes", shortLabel: "Quotes", icon: BadgeDollarSign },
  { href: "/portal/intakes", label: "Tax Organizer", shortLabel: "Organizer", icon: FileText },
  { href: "/portal/documents", label: "Documents", shortLabel: "Docs", icon: FolderOpen },
  { href: "/portal/document-requests", label: "Requests", shortLabel: "Requests", icon: ClipboardList },
  { href: "/portal/clarifications", label: "Clarifications", shortLabel: "Questions", icon: MessageCircleQuestion },
  { href: "/portal/messages", label: "Messages", shortLabel: "Messages", icon: MessagesSquare },
  { href: "/portal/appointments", label: "Appointments", shortLabel: "Calendar", icon: CalendarDays },
  { href: "/portal/signatures", label: "Signatures", shortLabel: "Sign", icon: PenTool },
  { href: "/portal/invoices", label: "Invoices & Payments", shortLabel: "Billing", icon: Receipt },
  { href: "/portal/returns", label: "Completed Returns", shortLabel: "Returns", icon: FileCheck2 },
  { href: "/portal/notifications", label: "Notifications", shortLabel: "Alerts", icon: Bell },
  { href: "/portal/profile", label: "Profile", shortLabel: "Profile", icon: UserRound },
];

/** Trimmed set for the mobile bottom bar — Engagements/Requests share a slot via Documents, full list stays in the drawer. */
export const PORTAL_BOTTOM_NAV_ITEMS: PortalNavItem[] = [
  PORTAL_NAV_ITEMS[0],
  PORTAL_NAV_ITEMS[3],
  PORTAL_NAV_ITEMS[4],
  PORTAL_NAV_ITEMS[6],
  PORTAL_NAV_ITEMS[7],
];
