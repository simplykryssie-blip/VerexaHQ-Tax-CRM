import { notFound } from "next/navigation";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { getPortalEngagementDetail } from "@/lib/data/portal-engagements";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { friendlyEngagementStatusMeta, friendlyEngagementNextAction, friendlyDocumentRequestStatusMeta, friendlyIntakeStatusMeta } from "@/lib/portal-copy";
import { returnTypeLabels } from "@/lib/status";
import { formatDate } from "@/lib/utils";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";

export default async function PortalEngagementDetailPage({
  params,
}: {
  params: Promise<{ engagementId: string }>;
}) {
  const { client } = await requirePortalAccess();
  if (!client) return <PortalNotLinkedState />;

  const { engagementId } = await params;
  const supabase = await createClient();
  const engagement = await getPortalEngagementDetail(supabase, client.client.id, engagementId);
  if (!engagement) notFound();

  const status = friendlyEngagementStatusMeta(engagement.status);
  const nextAction = friendlyEngagementNextAction(engagement.status);

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title={engagement.title}
        description={`Tax year ${engagement.tax_year ?? "—"}`}
        actions={<StatusBadge label={status.label} tone={status.tone} />}
      />

      {nextAction && (
        <div className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-800">{nextAction}</div>
      )}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Overview</h2>
        </CardHeader>
        <CardBody className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Return type</span>
            <span className="text-foreground">
              {engagement.return_type
                ? returnTypeLabels[engagement.return_type as keyof typeof returnTypeLabels] ?? engagement.return_type
                : "Not yet determined"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Due date</span>
            <span className="text-foreground">{formatDate(engagement.due_date)}</span>
          </div>
          {engagement.extension_requested && (
            <div className="flex justify-between">
              <span className="text-muted">Extension</span>
              <span className="text-foreground">{engagement.extension_filed ? "Filed" : "Requested"}</span>
            </div>
          )}
          {engagement.filed_at && (
            <div className="flex justify-between">
              <span className="text-muted">Filed</span>
              <span className="text-foreground">{formatDate(engagement.filed_at)}</span>
            </div>
          )}
          {engagement.completed_at && (
            <div className="flex justify-between">
              <span className="text-muted">Completed</span>
              <span className="text-foreground">{formatDate(engagement.completed_at)}</span>
            </div>
          )}
        </CardBody>
      </Card>

      {(engagement.intakeStatus || engagement.documentRequestStatus || engagement.openClarificationsCount > 0) && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">What we need from you</h2>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            {engagement.intakeStatus && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Tax intake</span>
                <StatusBadge {...friendlyIntakeStatusMeta(engagement.intakeStatus)} />
              </div>
            )}
            {engagement.documentRequestStatus && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Document request</span>
                <StatusBadge {...friendlyDocumentRequestStatusMeta(engagement.documentRequestStatus)} />
              </div>
            )}
            {engagement.openClarificationsCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted">Open questions</span>
                <StatusBadge label={`${engagement.openClarificationsCount} open`} tone="warning" />
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
