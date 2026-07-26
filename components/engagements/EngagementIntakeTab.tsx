import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { intakeSubmissionStatusMeta } from "@/lib/status";
import { formatDate } from "@/lib/utils";
import type { IntakeSubmission } from "@/lib/types";

export function EngagementIntakeTab({
  intakeSubmissions,
  openClarificationsCount,
}: {
  intakeSubmissions: IntakeSubmission[];
  openClarificationsCount: number;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Linked intake</h2>
        </CardHeader>
        <CardBody className="space-y-2">
          {intakeSubmissions.length === 0 ? (
            <p className="text-sm text-muted">No intake submission linked to this engagement yet.</p>
          ) : (
            intakeSubmissions.map((submission) => {
              const meta = intakeSubmissionStatusMeta(submission.status);
              return (
                <Link
                  key={submission.id}
                  href={`/intakes/${submission.id}`}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2 hover:bg-accent-50/40"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">Tax year {submission.tax_year ?? "—"}</p>
                    <p className="text-xs text-muted">Updated {formatDate(submission.updated_at)}</p>
                  </div>
                  <StatusBadge label={meta.label} tone={meta.tone} />
                </Link>
              );
            })
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Clarifications</h2>
        </CardHeader>
        <CardBody>
          {openClarificationsCount > 0 ? (
            <StatusBadge label={`${openClarificationsCount} open`} tone="warning" />
          ) : (
            <p className="text-sm text-muted">No open clarifications.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
