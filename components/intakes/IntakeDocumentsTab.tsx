import Link from "next/link";
import { FolderOpen, ArrowRight } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DocumentRequestProgress } from "@/components/intakes/DocumentRequestProgress";
import { documentRequestStatusMeta } from "@/lib/status";
import { formatDate } from "@/lib/utils";
import type { IntakeDocumentRule } from "@/lib/types";
import type { DocumentRequestListItem } from "@/lib/data/document-requests";

export function IntakeDocumentsTab({
  rules,
  requests,
}: {
  rules: IntakeDocumentRule[];
  requests: DocumentRequestListItem[];
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Required documents (from template rules)</h2>
        </CardHeader>
        <CardBody className="p-0">
          {rules.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={FolderOpen} title="No document rules configured for this template" />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {rules.map((rule) => (
                <li key={rule.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{rule.document_label}</p>
                    {rule.description && <p className="text-xs text-muted">{rule.description}</p>}
                  </div>
                  <StatusBadge label={rule.is_required ? "Required" : "Optional"} tone={rule.is_required ? "warning" : "neutral"} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Document requests sent to client</h2>
        </CardHeader>
        <CardBody className="p-0">
          {requests.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={FolderOpen}
                title="No document request sent yet"
                description="Use “Generate document request” in the actions panel to create one from these rules."
              />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {requests.map((request) => {
                const status = documentRequestStatusMeta(request.status);
                return (
                  <li key={request.id} className="space-y-2 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{request.title}</p>
                        <p className="text-xs text-muted">Due {formatDate(request.due_date)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge label={status.label} tone={status.tone} />
                        <Link
                          href={`/document-requests/${request.id}`}
                          className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 hover:underline"
                        >
                          Open <ArrowRight className="size-3.5" />
                        </Link>
                      </div>
                    </div>
                    <DocumentRequestProgress received={request.itemStats.received} total={request.itemStats.total} />
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
