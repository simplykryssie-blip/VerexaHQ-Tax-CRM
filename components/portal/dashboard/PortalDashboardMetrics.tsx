import { FileText, FolderOpen, MessageCircleQuestion, MessagesSquare } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { intakeSubmissionStatusMeta } from "@/lib/status";
import { friendlyIntakeStatusLabel } from "@/lib/portal-copy";
import type { PortalDashboardData } from "@/lib/data/portal-dashboard";

export function PortalDashboardMetrics({ data }: { data: PortalDashboardData }) {
  const status = data.currentIntake ? intakeSubmissionStatusMeta(data.currentIntake.status) : null;

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2 text-muted">
          <FileText className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Tax intake</span>
        </div>
        <p className="mt-2 text-sm font-semibold text-foreground">
          {data.currentIntake ? `Tax year ${data.currentIntake.tax_year ?? "—"}` : "No intake yet"}
        </p>
        {status && (
          <div className="mt-1">
            <StatusBadge label={friendlyIntakeStatusLabel(data.currentIntake!.status)} tone={status.tone} />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2 text-muted">
          <FolderOpen className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Documents needed</span>
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{data.missingDocumentsCount}</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2 text-muted">
          <MessageCircleQuestion className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Open questions</span>
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{data.openClarificationCount}</p>
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex items-center gap-2 text-muted">
          <MessagesSquare className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wide">Unread messages</span>
        </div>
        <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{data.unreadMessagesCount}</p>
      </div>
    </div>
  );
}
