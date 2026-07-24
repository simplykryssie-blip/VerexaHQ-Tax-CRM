import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Users, FileText, FolderOpen, Settings } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/intakes", label: "Intakes", icon: FileText },
  { href: "/document-requests", label: "Document Requests", icon: FolderOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];
