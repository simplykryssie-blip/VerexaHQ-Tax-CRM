import Link from "next/link";
import { FolderOpen } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/LegacyCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { documentRequestStatusMeta } from "@/lib/status";
import { clientDisplayName, formatDate } from "@/lib/utils";
import type { DocumentRequestWithClient } from "@/lib/data/dashboard";

export function DocumentRequestsDueCard({
  requests,
}: {
  requests: DocumentRequestWithClient[];
}) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Upcoming &amp; overdue document requests
        </h2>
        <Link href="/document-requests" className="text-sm text-accent-700 hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardBody className="p-0">
        {requests.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={FolderOpen} title="No document requests due" description="Nothing is currently outstanding." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((request) => {
              const status = documentRequestStatusMeta(request.status);
              const overdue = request.due_date && new Date(request.due_date) < new Date();
              return (
                <li key={request.id}>
                  <Link
                    href={`/document-requests/${request.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-accent-50/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {request.title}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {request.client ? clientDisplayName(request.client) : "Unknown client"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge label={status.label} tone={status.tone} />
                      <span className={overdue ? "text-xs font-medium text-red-600" : "text-xs text-muted"}>
                        {overdue ? "Overdue " : "Due "}
                        {formatDate(request.due_date)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
