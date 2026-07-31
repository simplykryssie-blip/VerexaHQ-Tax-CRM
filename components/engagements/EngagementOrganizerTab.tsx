import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/LegacyButton";
import { IntakeProgress } from "@/components/intakes/IntakeProgress";
import { AssignOrganizerPanel } from "@/components/engagements/AssignOrganizerPanel";
import { SendReminderDialog } from "@/components/engagements/SendReminderDialog";
import { ReopenOrganizerButton } from "@/components/engagements/ReopenOrganizerButton";
import { intakeSubmissionStatusMeta } from "@/lib/status";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { EngagementOrganizerSummary } from "@/lib/data/organizer";

type TemplateOption = { id: string; name: string; metadata: unknown };
type PriorSubmission = { id: string; taxYear: number | null };

export function EngagementOrganizerTab({
  engagementId,
  summary,
  templates,
  recommendedTemplateId,
  priorYearSubmissions,
  canManage,
}: {
  engagementId: string;
  summary: EngagementOrganizerSummary | null;
  templates: TemplateOption[];
  recommendedTemplateId: string | null;
  priorYearSubmissions: PriorSubmission[];
  canManage: boolean;
}) {
  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Assign a tax organizer</h2>
        </CardHeader>
        <CardBody>
          {canManage ? (
            <AssignOrganizerPanel
              engagementId={engagementId}
              templates={templates.map((t) => ({ id: t.id, name: t.name }))}
              recommendedTemplateId={recommendedTemplateId}
              priorYearSubmissions={priorYearSubmissions}
            />
          ) : (
            <p className="text-sm text-muted">No organizer has been assigned to this engagement yet.</p>
          )}
        </CardBody>
      </Card>
    );
  }

  const { submission } = summary;
  const status = intakeSubmissionStatusMeta(submission.status);
  const canReopen = ["approved", "rejected", "archived"].includes(submission.status);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Organizer summary</h2>
          <StatusBadge label={status.label} tone={status.tone} />
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Template</p>
              <p className="text-sm text-foreground">{summary.templateName ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Client completion</p>
              <IntakeProgress percent={Math.round(submission.progress_percent)} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Staff review</p>
              <p className="text-sm text-foreground">
                {summary.totalReviewSectionsCount === 0
                  ? "Not started"
                  : `${summary.reviewedSectionsCount}/${summary.totalReviewSectionsCount} sections`}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Current section</p>
              <p className="text-sm text-foreground">{summary.currentSectionTitle ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Missing answers</p>
              <p className="text-sm text-foreground">{summary.missingAnswersCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Open clarifications</p>
              <p className="text-sm text-foreground">{summary.unresolvedClarificationsCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Rolled forward, unconfirmed</p>
              <p className="text-sm text-foreground">{summary.rolledForwardCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Reviewer</p>
              <p className="text-sm text-foreground">{summary.reviewer?.name ?? "Unassigned"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Last activity</p>
              <p className="text-sm text-foreground">{formatDateTime(submission.last_saved_at ?? submission.updated_at)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Submitted</p>
              <p className="text-sm text-foreground">{formatDate(submission.submitted_at)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Link href={`/engagements/${engagementId}/organizer`}>
              <Button size="sm">
                Review Organizer <ExternalLink className="size-4" />
              </Button>
            </Link>
            {canManage && <SendReminderDialog submissionId={submission.id} />}
            {canManage && canReopen && <ReopenOrganizerButton submissionId={submission.id} />}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
