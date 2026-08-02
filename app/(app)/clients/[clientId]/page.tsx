import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { getClientDetailExtended } from "@/lib/data/clients-extended";
import { listDocumentRequestsForClient } from "@/lib/data/document-requests";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, type TabDefinition } from "@/components/ui/TabSwitcher";
import { ClientOverviewTab } from "@/components/clients/ClientOverviewTab";
import { ClientContactTab } from "@/components/clients/ClientContactTab";
import { ClientIntakesTab } from "@/components/clients/ClientIntakesTab";
import { ClientIncomeTab } from "@/components/clients/ClientIncomeTab";
import { ClientDeductionsTab } from "@/components/clients/ClientDeductionsTab";
import { ClientDocumentRequestsTab } from "@/components/clients/ClientDocumentRequestsTab";
import { clientStatusMeta } from "@/lib/status";
import { clientDisplayName } from "@/lib/utils";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";
import { ClientWorkspaceTabs } from "@/components/clients/ClientWorkspaceTabs";
import { ClientEngagementsTab, ClientQuotesTab, ClientRelationshipGroupsTab, type ClientEngagementSummary, type ClientQuoteSummary, type ClientHouseholdSummary } from "@/features/clients/client-operations-tabs";
import { Button } from "@/components/ui/LegacyButton";
import Link from "next/link";
import { EditClientDialog } from "@/features/clients/edit-client-dialog";
import { requirePermission } from "@/lib/permissions/granular";
import { ForbiddenState } from "@/components/ui/ForbiddenState";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;
  const [viewAccess,editAccess,engagementAccess,previewAccess]=await Promise.all([requirePermission(workspace.workspace.id,"clients.view"),requirePermission(workspace.workspace.id,"clients.edit"),requirePermission(workspace.workspace.id,"engagements.create"),requirePermission(workspace.workspace.id,"portal.preview")]);
  if(!viewAccess.allowed)return <ForbiddenState description={viewAccess.reason}/>;

  const { clientId } = await params;
  const supabase = await createClient();
  const detail = await getClientDetailExtended(supabase, workspace.workspace.id, clientId);
  if (!detail) notFound();

  const documentRequests = await listDocumentRequestsForClient(
    supabase,
    workspace.workspace.id,
    clientId,
  );
  const [engagementsResult,quotesResult,householdsResult]=await Promise.all([
    supabase.from("tax_engagements").select("id,engagement_number,title,tax_year,status,updated_at").eq("workspace_id",workspace.workspace.id).eq("client_id",clientId).order("updated_at",{ascending:false}),
    supabase.from("client_quotes").select("id,quote_number,quote_type,status,amount,amount_min,amount_max,created_at").eq("workspace_id",workspace.workspace.id).eq("client_id",clientId).order("created_at",{ascending:false}),
    supabase.from("household_members").select("id,household_id,relationship,household:tax_households(household_name)").eq("workspace_id",workspace.workspace.id).eq("client_id",clientId),
  ]);

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
      id: "tax-profile",
      label: "Tax profile",
      content: <ClientWorkspaceTabs clientDetail={detail} workspaceId={workspace.workspace.id} />,
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
      id: "engagements",
      label: "Engagements",
      content: <ClientEngagementsTab items={(engagementsResult.data??[]) as ClientEngagementSummary[]} />,
    },
    {
      id: "documents",
      label: "Documents & requests",
      content: <ClientDocumentRequestsTab requests={documentRequests} />,
    },
    { id:"quotes",label:"Quotes",content:<ClientQuotesTab items={(quotesResult.data??[]) as ClientQuoteSummary[]}/> },
    { id:"household",label:"Household / family",content:<ClientRelationshipGroupsTab items={(householdsResult.data??[]) as unknown as ClientHouseholdSummary[]}/> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={clientDisplayName(detail.client)}
        description={detail.client.email ?? undefined}
        actions={<div className="flex items-center gap-2"><StatusBadge label={status.label} tone={status.tone} />{previewAccess.allowed&&<Link href={`/clients/${clientId}/portal-preview`}><Button size="sm" variant="secondary">Preview as Client</Button></Link>}{editAccess.allowed&&<EditClientDialog client={detail.client}/>} {engagementAccess.allowed&&<Link href={`/engagements/new?clientId=${clientId}`}><Button size="sm">New engagement</Button></Link>}</div>}
      />
      <Tabs tabs={tabs} />
    </div>
  );
}
