import Link from "next/link";
import { ArrowRight, FolderOpen } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  listDocumentRequests,
  DOCUMENT_REQUESTS_PAGE_SIZE,
  type DocumentRequestListItem,
} from "@/lib/data/document-requests";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DocumentRequestsFilterBar } from "@/components/document-requests/DocumentRequestsFilterBar";
import { documentRequestStatusMeta } from "@/lib/status";
import { clientDisplayName, formatDate, formatRelativeTime } from "@/lib/utils";
import type { DocumentRequestStatus } from "@/lib/types";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

const VALID_STATUSES: DocumentRequestStatus[] = [
  "draft",
  "sent",
  "viewed",
  "in_progress",
  "partially_complete",
  "completed",
  "cancelled",
  "expired",
];

export default async function DocumentRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; missingDocuments?: string; page?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const params = await searchParams;
  const page = Number(params.page) > 0 ? Number(params.page) : 1;
  const status = VALID_STATUSES.includes(params.status as DocumentRequestStatus)
    ? (params.status as DocumentRequestStatus)
    : undefined;

  const supabase = await createClient();
  const { requests, total } = await listDocumentRequests(supabase, workspace.workspace.id, {
    page,
    status,
    missingDocuments: params.missingDocuments === "1",
  });

  const columns: DataTableColumn<DocumentRequestListItem>[] = [
    {
      key: "title",
      header: "Request",
      render: (request) => <span className="font-medium text-foreground">{request.title}</span>,
    },
    {
      key: "client",
      header: "Client",
      render: (request) => (request.client ? clientDisplayName(request.client) : "Unknown client"),
    },
    {
      key: "engagement",
      header: "Tax year",
      render: (request) => request.engagement?.tax_year ?? "—",
    },
    {
      key: "status",
      header: "Status",
      render: (request) => {
        const meta = documentRequestStatusMeta(request.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    { key: "total", header: "Total requested", render: (request) => request.itemStats.total },
    { key: "received", header: "Received", render: (request) => request.itemStats.received },
    {
      key: "outstanding",
      header: "Outstanding",
      render: (request) =>
        request.itemStats.outstanding > 0 ? (
          <StatusBadge label={String(request.itemStats.outstanding)} tone="warning" />
        ) : (
          <span className="text-muted">0</span>
        ),
    },
    { key: "due", header: "Due date", render: (request) => formatDate(request.due_date) },
    {
      key: "activity",
      header: "Last activity",
      render: (request) => formatRelativeTime(request.lastActivityAt),
    },
    {
      key: "action",
      header: "",
      className: "text-right",
      render: (request) => (
        <Link
          href={`/document-requests/${request.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 hover:underline"
        >
          Open <ArrowRight className="size-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Document requests" description="Track outstanding client document collection." />

      <DocumentRequestsFilterBar status={params.status ?? ""} missingDocuments={params.missingDocuments ?? ""} />

      <Card>
        {requests.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={FolderOpen} title="No document requests found" description="Try adjusting your filters." />
          </div>
        ) : (
          <>
            <DataTable columns={columns} rows={requests} rowKey={(r) => r.id} />
            <Pagination
              page={page}
              pageSize={DOCUMENT_REQUESTS_PAGE_SIZE}
              total={total}
              buildHref={(p) => {
                const sp = new URLSearchParams();
                if (params.status) sp.set("status", params.status);
                if (params.missingDocuments) sp.set("missingDocuments", params.missingDocuments);
                sp.set("page", String(p));
                return `/document-requests?${sp.toString()}`;
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}
