import { notFound } from "next/navigation";
import Link from "next/link";
import { requireWorkspace } from "@/lib/auth/workspace";
import { Button } from "@/components/ui/LegacyButton";
import { STAFF_ROLES } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { getClientDetail } from "@/lib/data/clients";
import { listDocumentRequestsForClient } from "@/lib/data/document-requests";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, type TabDefinition } from "@/components/ui/TabSwitcher";
import { ClientOverviewTab } from "@/components/clients/ClientOverviewTab";
import { ClientContactTab } from "@/components/clients/ClientContactTab";
import { ClientIntakesTab } from "@/components/clients/ClientIntakesTab";
import { ClientHouseholdTab } from "@/components/clients/ClientHouseholdTab";
import { ClientIncomeTab } from "@/components/clients/ClientIncomeTab";
import { ClientDeductionsTab } from "@/components/clients/ClientDeductionsTab";
import { ClientDocumentRequestsTab } from "@/components/clients/ClientDocumentRequestsTab";
import { clientStatusMeta } from "@/lib/status";
import { clientDisplayName } from "@/lib/utils";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const { clientId } = await params;
  const supabase = await createClient();
  const detail = await getClientDetail(supabase, workspace.workspace.id, clientId);
  if (!detail) notFound();

  const documentRequests = await listDocumentRequestsForClient(
    supabase,
    workspace.workspace.id,
    clientId,
  );

  const status = clientStatusMeta(detail.client.status);

  const tabs: TabDefinition[] = [
    { id: "overview", label: "Overview", content: <ClientOverviewTab client={detail.client} /> },
    {
      id: "contact",
      label: "Contact information",
      content: <ClientContactTab contacts={detail.contacts} addresses={detail.addresses} />,
    },
    {
      id: "intakes",
      label: "Tax intakes",
      content: <ClientIntakesTab submissions={detail.intakeSubmissions} />,
    },
    {
      id: "household",
      label: "Household",
      content: <ClientHouseholdTab people={detail.currentIntake?.household ?? []} />,
    },
    {
      id: "income",
      label: "Income",
      content: <ClientIncomeTab sources={detail.currentIntake?.income ?? []} />,
    },
    {
      id: "deductions",
      label: "Deductions and credits",
      content: <ClientDeductionsTab items={detail.currentIntake?.deductions ?? []} />,
    },
    {
      id: "documents",
      label: "Document requests",
      content: <ClientDocumentRequestsTab requests={documentRequests} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={clientDisplayName(detail.client)}
        description={detail.client.email ?? undefined}
        actions={
          <>
            <StatusBadge label={status.label} tone={status.tone} />
            {STAFF_ROLES.includes(workspace.role) && (
              <Link href={`/clients/${clientId}/edit`}>
                <Button variant="secondary" size="sm">
                  Edit
                </Button>
              </Link>
            )}
          </>
        }
      />
      <Tabs tabs={tabs} />
    </div>
  );
}
