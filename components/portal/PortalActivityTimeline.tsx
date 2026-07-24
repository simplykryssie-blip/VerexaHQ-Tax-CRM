import type { LucideIcon } from "lucide-react";
import { Circle } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";

export type PortalActivityItem = {
  id: string;
  label: string;
  timestamp: string;
  icon?: LucideIcon;
};

export function PortalActivityTimeline({ items }: { items: PortalActivityItem[] }) {
  if (items.length === 0) {
    return <PortalEmptyState title="No recent activity" description="Updates on your tax intake and documents will show up here." />;
  }

  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const Icon = item.icon ?? Circle;
        return (
          <li key={item.id} className="flex items-start gap-3">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600">
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-foreground">{item.label}</p>
              <p className="text-xs text-muted">{formatRelativeTime(item.timestamp)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
