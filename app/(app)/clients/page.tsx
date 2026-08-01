import Link from "next/link";
import { UserPlus, Users, ArrowRight } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { listClients, CLIENTS_PAGE_SIZE, type ClientListItem } from "@/lib/data/clients";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/LegacyButton";
import { Card } from "@/components/ui/LegacyCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ClientsFilterBar } from "@/components/clients/ClientsFilterBar";
import { clientStatusMeta, intakeSubmissionStatusMeta } from "@/lib/status";
import { clientDisplayName, formatRelativeTime, titleCase } from "@/lib/utils";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const params = await searchParams;
  const page = Number(params.page) > 0 ? Number(params.page) : 1;

  const supabase = await createClient();
  const { clients, total } = await listClients(supabase, workspace.workspace.id, {
    q: params.q,
    status: params.status,
    page,
  });

  const columns: DataTableColumn<ClientListItem>[] = [
    {
      key: "name",
      header: "Client",
      render: (client) => (
        <div>
          <p className="font-medium text-foreground">{clientDisplayName(client)}</p>
          <p className="text-xs text-muted">{titleCase(client.client_type)}</p>
        </div>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (client) => client.email || "—",
    },
    {
      key: "phone",
      header: "Phone",
      render: (client) => client.phone || "—",
    },
    {
      key: "status",
      header: "Status",
      render: (client) => {
        const meta = clientStatusMeta(client.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    {
      key: "intake",
      header: "Tax intake status",
      render: (client) => {
        if (!client.latestIntake) return <span className="text-muted">No intake</span>;
        const meta = intakeSubmissionStatusMeta(client.latestIntake.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    {
      key: "activity",
      header: "Last activity",
      render: (client) => (
        <span className="text-muted">
          {formatRelativeTime(client.latestIntake?.updatedAt ?? client.updated_at)}
        </span>
      ),
    },
    {
      key: "action",
      header: "",
      className: "text-right",
      render: (client) => (
        <Link
          href={`/clients/${client.id}`}
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
        title="Clients"
        description="Manage every client engaged with your firm."
        actions={
          <Link href="/clients/new">
            <Button size="sm">
              <UserPlus className="size-4" />
              Add client
            </Button>
          </Link>
        }
      />

      <ClientsFilterBar initialQ={params.q ?? ""} initialStatus={params.status ?? ""} />

      <Card>
        {clients.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={Users}
              title="No clients found"
              description="Try adjusting your search or filters, or add a new client."
              action={
                <Link href="/clients/new">
                  <Button size="sm">Add client</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <DataTable columns={columns} rows={clients} rowKey={(c) => c.id} />
            <Pagination
              page={page}
              pageSize={CLIENTS_PAGE_SIZE}
              total={total}
              buildHref={(p) => {
                const sp = new URLSearchParams();
                if (params.q) sp.set("q", params.q);
                if (params.status) sp.set("status", params.status);
                sp.set("page", String(p));
                return `/clients?${sp.toString()}`;
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}
