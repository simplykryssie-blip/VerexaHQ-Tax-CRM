import { Card, CardBody, CardHeader } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  engagementStatusMeta,
  engagementPriorityMeta,
  engagementEfileStatusMeta,
  engagementPaymentStatusMeta,
  returnTypeLabels,
  engagementTypeLabels,
} from "@/lib/status";
import { formatDate, clientDisplayName } from "@/lib/utils";
import type { TaxEngagement, Client } from "@/lib/types";
import type { UserSummary } from "@/lib/data/users";

export function EngagementOverviewTab({
  engagement,
  client,
  preparer,
  reviewer,
  responsibleStaff,
}: {
  engagement: TaxEngagement;
  client: Client | null;
  preparer: UserSummary | null;
  reviewer: UserSummary | null;
  responsibleStaff: UserSummary | null;
}) {
  const statusMeta = engagementStatusMeta(engagement.status);
  const priorityMeta = engagementPriorityMeta(engagement.priority);
  const efileMeta = engagementEfileStatusMeta(engagement.efile_status);
  const paymentMeta = engagementPaymentStatusMeta(engagement.payment_status);

  const field = (label: string, value: React.ReactNode) => (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Overview</h2>
        </CardHeader>
        <CardBody>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {field("Client", client ? clientDisplayName(client) : "—")}
            {field("Tax year", engagement.tax_year ?? "—")}
            {field("Return type", engagement.return_type ? returnTypeLabels[engagement.return_type] : "—")}
            {field("Engagement type", engagementTypeLabels[engagement.engagement_type] ?? engagement.engagement_type)}
            {field("Status", <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />)}
            {field("Priority", <StatusBadge label={priorityMeta.label} tone={priorityMeta.tone} />)}
            {field("Preparer", preparer?.name ?? "Unassigned")}
            {field("Reviewer", reviewer?.name ?? "Unassigned")}
            {field("Responsible staff", responsibleStaff?.name ?? "Unassigned")}
            {field("Due date", formatDate(engagement.due_date))}
            {field("Internal due date", formatDate(engagement.internal_due_date))}
            {field("Extension due date", formatDate(engagement.extension_due_date))}
            {field("Jurisdiction", engagement.jurisdiction ?? "Federal only")}
            {field(
              "Filing requirements",
              [
                engagement.federal_return_required ? "Federal" : null,
                engagement.state_return_required ? "State" : null,
                engagement.local_return_required ? "Local" : null,
              ]
                .filter(Boolean)
                .join(", ") || "None",
            )}
            {field("E-file status", <StatusBadge label={efileMeta.label} tone={efileMeta.tone} />)}
            {field("Payment status", <StatusBadge label={paymentMeta.label} tone={paymentMeta.tone} />)}
            {engagement.balance_due != null && engagement.balance_due > 0 &&
              field("Balance due", `$${engagement.balance_due.toFixed(2)}`)}
            {engagement.refund_amount != null && engagement.refund_amount > 0 &&
              field("Refund amount", `$${engagement.refund_amount.toFixed(2)}`)}
          </dl>

          {engagement.description && (
            <div className="mt-4 border-t border-border pt-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Description</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{engagement.description}</dd>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
