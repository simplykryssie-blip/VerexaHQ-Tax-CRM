import { notFound } from "next/navigation";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { getPortalDocumentRequestDetail } from "@/lib/data/portal-document-requests";
import { computeItemStats } from "@/lib/data/document-requests";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DocumentRequestProgress } from "@/components/intakes/DocumentRequestProgress";
import { PortalRequestItemCard } from "@/components/portal/documents/PortalRequestItemCard";
import { friendlyDocumentRequestStatusMeta } from "@/lib/portal-copy";
import { formatDate } from "@/lib/utils";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";

export default async function PortalDocumentRequestDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { client } = await requirePortalAccess();
  if (!client) return <PortalNotLinkedState />;

  const { requestId } = await params;
  const supabase = await createClient();
  const request = await getPortalDocumentRequestDetail(supabase, client.client.id, requestId);
  if (!request) notFound();

  const status = friendlyDocumentRequestStatusMeta(request.status);
  const stats = computeItemStats(request.items);
  const canUpload = !["completed", "cancelled", "expired"].includes(request.status);

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title={request.title}
        description={request.engagement?.tax_year ? `Tax year ${request.engagement.tax_year}` : undefined}
        actions={<StatusBadge label={status.label} tone={status.tone} />}
      />

      <Card>
        <CardBody className="space-y-3">
          <DocumentRequestProgress received={stats.received} total={stats.total} />
          <p className="text-sm text-muted">Due {formatDate(request.due_date)}</p>
          {request.client_message && (
            <div className="rounded-lg bg-accent-50 px-3 py-2 text-sm text-accent-800">{request.client_message}</div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Requested items</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {request.items.map((item) => (
            <PortalRequestItemCard
              key={item.id}
              item={item}
              workspaceId={client.client.workspace_id}
              clientId={client.client.id}
              canUpload={canUpload}
            />
          ))}
        </CardBody>
      </Card>
    </div>
  );
}
