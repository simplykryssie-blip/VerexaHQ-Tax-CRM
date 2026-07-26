import Link from "next/link";
import { PlusCircle, Briefcase, ArrowRight } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { listEngagements, ENGAGEMENTS_PAGE_SIZE, type EngagementListItem } from "@/lib/data/engagements";
import { listWorkspaceStaff } from "@/lib/data/users";
import { engagementListFiltersSchema } from "@/lib/validation/engagements";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EngagementsFilterBar } from "@/components/engagements/EngagementsFilterBar";
import { engagementStatusMeta, engagementPriorityMeta, returnTypeLabels } from "@/lib/status";
import { clientDisplayName, formatDate } from "@/lib/utils";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function EngagementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const params = await searchParams;
  const parsedFilters = engagementListFiltersSchema.safeParse({
    q: params.q,
    taxYear: params.taxYear,
    status: params.status,
    returnType: params.returnType,
    engagementType: params.engagementType,
    preparerUserId: params.preparerUserId,
    reviewerUserId: params.reviewerUserId,
    priority: params.priority,
    dueDateState: params.dueDateState,
    clientId: params.clientId,
    page: params.page,
  });
  const filters = parsedFilters.success ? parsedFilters.data : {};
  const page = filters.page ?? 1;

  const supabase = await createClient();
  const [{ engagements, total }, staff] = await Promise.all([
    listEngagements(supabase, workspace.workspace.id, filters),
    listWorkspaceStaff(supabase, workspace.workspace.id),
  ]);

  const columns: DataTableColumn<EngagementListItem>[] = [
    {
      key: "reference",
      header: "Reference",
      render: (e) => <span className="font-mono text-xs text-muted">{e.engagement_number ?? "—"}</span>,
    },
    {
      key: "client",
      header: "Client",
      render: (e) => (e.client ? clientDisplayName(e.client) : "—"),
    },
    {
      key: "title",
      header: "Title",
      render: (e) => (
        <div>
          <p className="font-medium text-foreground">{e.title}</p>
          <p className="text-xs text-muted">
            {e.tax_year ?? "—"} · {e.return_type ? returnTypeLabels[e.return_type] : "—"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (e) => {
        const meta = engagementStatusMeta(e.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    {
      key: "priority",
      header: "Priority",
      render: (e) => {
        const meta = engagementPriorityMeta(e.priority);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    {
      key: "preparer",
      header: "Preparer",
      render: (e) => e.preparer?.name ?? "Unassigned",
    },
    {
      key: "reviewer",
      header: "Reviewer",
      render: (e) => e.reviewer?.name ?? "Unassigned",
    },
    {
      key: "due",
      header: "Due date",
      render: (e) => formatDate(e.due_date),
    },
    {
      key: "missing",
      header: "Missing items",
      render: (e) => (e.missingItemsCount > 0 ? <StatusBadge label={String(e.missingItemsCount)} tone="warning" /> : "—"),
    },
    {
      key: "updated",
      header: "Updated",
      render: (e) => formatDate(e.updated_at),
    },
    {
      key: "action",
      header: "",
      className: "text-right",
      render: (e) => (
        <Link
          href={`/engagements/${e.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 hover:underline"
        >
          Open <ArrowRight className="size-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Engagements"
        description="Track and manage every tax engagement in your workspace."
        actions={
          <Link href="/engagements/new">
            <Button size="sm">
              <PlusCircle className="size-4" />
              New engagement
            </Button>
          </Link>
        }
      />

      <EngagementsFilterBar
        initialValues={{
          q: params.q ?? "",
          taxYear: params.taxYear ?? "",
          status: params.status ?? "",
          returnType: params.returnType ?? "",
          engagementType: params.engagementType ?? "",
          preparerUserId: params.preparerUserId ?? "",
          reviewerUserId: params.reviewerUserId ?? "",
          priority: params.priority ?? "",
          dueDateState: params.dueDateState ?? "",
        }}
        staff={staff}
      />

      <Card>
        {engagements.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Briefcase}
              title="No engagements found"
              description="Try adjusting your search or filters, or create a new engagement."
              action={
                <Link href="/engagements/new">
                  <Button size="sm">New engagement</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <DataTable columns={columns} rows={engagements} rowKey={(e) => e.id} />
            <Pagination
              page={page}
              pageSize={ENGAGEMENTS_PAGE_SIZE}
              total={total}
              buildHref={(p) => {
                const sp = new URLSearchParams();
                for (const [key, value] of Object.entries(params)) {
                  if (value && key !== "page") sp.set(key, value);
                }
                sp.set("page", String(p));
                return `/engagements?${sp.toString()}`;
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}
