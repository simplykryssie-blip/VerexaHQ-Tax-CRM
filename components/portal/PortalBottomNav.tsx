"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PORTAL_BOTTOM_NAV_ITEMS } from "@/components/portal/nav";
import { cn } from "@/lib/utils";

export function PortalBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-white/95 backdrop-blur lg:hidden">
      {PORTAL_BOTTOM_NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium",
              active ? "text-accent-700" : "text-slate-500",
            )}
          >
            <Icon className="size-5" />
            {item.shortLabel}
          </Link>
        );
      })}
    </nav>
  );
}
