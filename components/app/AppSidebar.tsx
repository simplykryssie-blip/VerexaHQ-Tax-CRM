"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { NAV_ITEMS } from "@/components/app/nav";
import { cn } from "@/lib/utils";

export function AppSidebar({
  workspaceName,
  onNavigate,
}: {
  workspaceName: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-border px-5 py-5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-accent-600 text-white">
          <ShieldCheck className="size-4.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            VerexaHQ Tax CRM
          </p>
          <p className="truncate text-xs text-muted">{workspaceName}</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-accent-50 text-accent-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-foreground",
              )}
            >
              <Icon className="size-4.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
