import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { PortalNextAction } from "@/lib/data/portal-dashboard";

export function PortalNextActionCard({ action }: { action: PortalNextAction | null }) {
  if (!action) {
    return (
      <div className="flex items-center gap-4 rounded-2xl border border-accent-200 bg-accent-50/60 p-6">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <CheckCircle2 className="size-5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">You&apos;re all caught up</p>
          <p className="text-sm text-muted">Nothing needs your attention right now.</p>
        </div>
      </div>
    );
  }

  const Icon = action.icon;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          <Icon className="size-5" />
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent-700">
            What you need to do next
          </p>
          <p className="mt-0.5 text-base font-semibold text-foreground">{action.title}</p>
          <p className="text-sm text-muted">{action.description}</p>
        </div>
      </div>
      <Link href={action.href} className="shrink-0">
        <Button className="w-full sm:w-auto">Go</Button>
      </Link>
    </div>
  );
}
