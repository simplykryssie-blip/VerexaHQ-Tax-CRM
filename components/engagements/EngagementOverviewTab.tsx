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
  const metadata = (engagement.metadata && typeof engagement.metadata === "object" && !Array.isArray(engagement.metadata)
    ? engagement.metadata
    : {}) as Record<string, unknown>;
  const schedule = (metadata.deadline_schedule && typeof metadata.deadline_schedule === "object"
    ? metadata.deadline_schedule
    : {}) as { items?: Array<{ jurisdiction?: string; filingDate?: string | null; paymentDate?: string | null; extensionDate?: string | null; ruleStatus?: string; note?: string }> };
  const staffDeadlines = (metadata.staff_deadlines && typeof metadata.staff_deadlines === "object"
    ? metadata.staff_deadlines
    : {}) as Record<string, unknown>;

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
            {field("Primary statutory filing deadline", formatDate(engagement.due_date))}
            {field("Internal preparation target", formatDate(engagement.internal_due_date))}
            {field("Active extended filing deadline", engagement.extension_filed ? formatDate(engagement.extension_due_date) : "No extension marked filed")}
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

          {schedule.items && schedule.items.length > 0 && (
            <div className="mt-6 border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground">Statutory deadline schedule</h3>
              <div className="mt-3 grid gap-3">
                {schedule.items.map((item, index) => (
                  <div key={`${item.jurisdiction}-${index}`} className="rounded-lg border border-border bg-slate-50 p-3 text-sm">
                    <p className="font-medium text-foreground">{item.jurisdiction ?? "Jurisdiction"}</p>
                    <div className="mt-2 grid gap-1 text-muted sm:grid-cols-3">
                      <span>File: {item.filingDate ? formatDate(item.filingDate) : "Review required"}</span>
                      <span>Pay: {item.paymentDate ? formatDate(item.paymentDate) : "Review required"}</span>
                      <span>Extended: {item.extensionDate ? formatDate(item.extensionDate) : "—"}</span>
                    </div>
                    {item.note && <p className="mt-2 text-xs text-warning">{item.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.values(staffDeadlines).some(Boolean) && (
            <div className="mt-6 border-t border-border pt-5">
              <h3 className="text-sm font-semibold text-foreground">Staff-controlled deadlines</h3>
              <dl className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {field("Client documents", formatDate(staffDeadlines.client_document_deadline as string | null))}
                {field("Preparation target", formatDate(staffDeadlines.internal_preparation_target as string | null))}
                {field("Reviewer", formatDate(staffDeadlines.reviewer_deadline as string | null))}
                {field("Signature", formatDate(staffDeadlines.signature_deadline as string | null))}
              </dl>
            </div>
          )}

          {engagement.description && (
            <div className="mt-4 border-t border-border pt-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted">Engagement scope / internal notes</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm text-foreground">{engagement.description}</dd>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
