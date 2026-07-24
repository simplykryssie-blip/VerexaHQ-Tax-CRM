import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IntakeProgress } from "@/components/intakes/IntakeProgress";
import { intakeSubmissionStatusMeta } from "@/lib/status";
import { clientDisplayName, formatDate, formatDateTime } from "@/lib/utils";
import type { Client, IntakeSubmission } from "@/lib/types";

export function IntakeDetailHeader({
  submission,
  client,
}: {
  submission: IntakeSubmission;
  client: Client | null;
}) {
  const status = intakeSubmissionStatusMeta(submission.status);

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Client</p>
            {client ? (
              <Link href={`/clients/${client.id}`} className="text-lg font-semibold text-accent-700 hover:underline">
                {clientDisplayName(client)}
              </Link>
            ) : (
              <p className="text-lg font-semibold text-foreground">Unknown client</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Tax year</p>
            <p className="text-lg font-semibold text-foreground">{submission.tax_year ?? "—"}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Status</p>
            <StatusBadge label={status.label} tone={status.tone} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Progress</p>
            <IntakeProgress percent={submission.progress_percent} />
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Submitted</p>
            <p className="text-sm text-foreground">{formatDateTime(submission.submitted_at)}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Last saved</p>
            <p className="text-sm text-foreground">{formatDateTime(submission.last_saved_at)}</p>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Revision</p>
            <p className="text-sm text-foreground">#{submission.revision_number}</p>
          </div>
        </div>

        {submission.status === "changes_requested" && submission.change_request_message && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {submission.change_request_message}
          </p>
        )}

        {submission.reopen_reason && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-muted">
            Reopened {formatDate(submission.reopened_at)}: {submission.reopen_reason}
          </p>
        )}
      </CardBody>
    </Card>
  );
}
