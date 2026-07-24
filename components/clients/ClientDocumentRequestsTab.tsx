import Link from "next/link";
import { FolderOpen, ArrowRight } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { documentRequestStatusMeta } from "@/lib/status";
import { formatDate } from "@/lib/utils";
import type { DocumentRequestListItem } from "@/lib/data/document-requests";

export function ClientDocumentRequestsTab({ requests }: { requests: DocumentRequestListItem[] }) {
  if (requests.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState icon={FolderOpen} title="No document requests yet" />
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const status = documentRequestStatusMeta(request.status);
        return (
          <Card key={request.id}>
            <CardBody className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-foreground">{request.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {request.itemStats.received}/{request.itemStats.total} received · Due {formatDate(request.due_date)}
                </p>
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
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}
