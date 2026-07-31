import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { intakeSubmissionStatusMeta } from "@/lib/status";
import { formatDate } from "@/lib/utils";
import type { IntakeSubmission } from "@/lib/types";

export function ClientIntakesTab({ submissions }: { submissions: IntakeSubmission[] }) {
  if (submissions.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState icon={FileText} title="No tax intakes yet" description="This client has no intake submissions on file." />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {submissions.map((submission) => {
        const status = intakeSubmissionStatusMeta(submission.status);
        return (
          <Card key={submission.id}>
            <CardBody className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Tax year {submission.tax_year ?? "—"}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {submission.progress_percent}% complete · Submitted {formatDate(submission.submitted_at)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge label={status.label} tone={status.tone} />
                <Link
                  href={`/intakes/${submission.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 hover:underline"
                >
                  Open <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
