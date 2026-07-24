import { notFound } from "next/navigation";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { getDocumentRequestDetail, computeItemStats } from "@/lib/data/document-requests";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DocumentRequestProgress } from "@/components/intakes/DocumentRequestProgress";
import { documentRequestItemStatusMeta, documentRequestStatusMeta } from "@/lib/status";
import { clientDisplayName, formatDate } from "@/lib/utils";
import { FileText } from "lucide-react";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function DocumentRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const { requestId } = await params;
  const supabase = await createClient();
  const detail = await getDocumentRequestDetail(supabase, workspace.workspace.id, requestId);
  if (!detail) notFound();

  const status = documentRequestStatusMeta(detail.request.status);
  const stats = computeItemStats(detail.items);

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.request.title}
        description={detail.client ? clientDisplayName(detail.client) : "Unknown client"}
        actions={<StatusBadge label={status.label} tone={status.tone} />}
      />

      <Card>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Client</p>
              {detail.client ? (
                <Link href={`/clients/${detail.client.id}`} className="text-sm font-medium text-accent-700 hover:underline">
                  {clientDisplayName(detail.client)}
                </Link>
              ) : (
                <p className="text-sm text-foreground">Unknown</p>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Tax year</p>
              <p className="text-sm text-foreground">{detail.engagement?.tax_year ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Due date</p>
              <p className="text-sm text-foreground">{formatDate(detail.request.due_date)}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Sent</p>
              <p className="text-sm text-foreground">{formatDate(detail.request.sent_at)}</p>
            </div>
          </div>

          <DocumentRequestProgress received={stats.received} total={stats.total} />

          {detail.request.client_message && (
            <div className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-800">
              {detail.request.client_message}
            </div>
          )}
          {detail.request.internal_notes && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-muted">
              <span className="font-medium text-foreground">Internal notes: </span>
              {detail.request.internal_notes}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Requested items</h2>
        </CardHeader>
        <CardBody className="p-0">
          {detail.items.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={FileText} title="No items on this request" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {detail.items.map((item) => {
                const itemStatus = documentRequestItemStatusMeta(item.status);
                return (
                  <li key={item.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {item.custom_label || item.document_label}
                          {item.category && (
                            <span className="ml-2 text-xs font-normal text-muted">
                              {item.category.name}
                            </span>
                          )}
                        </p>
                        {item.description && (
                          <p className="mt-1 text-sm text-muted">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge label={item.is_required ? "Required" : "Optional"} tone={item.is_required ? "warning" : "neutral"} />
                        <StatusBadge label={itemStatus.label} tone={itemStatus.tone} />
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {item.uploaded_file_count} uploaded · {item.accepted_file_count} accepted
                      {item.waiver_reason ? ` · Waived: ${item.waiver_reason}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
