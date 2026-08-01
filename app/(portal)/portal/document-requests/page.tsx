import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { listPortalDocumentRequests } from "@/lib/data/portal-document-requests";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DocumentRequestProgress } from "@/components/intakes/DocumentRequestProgress";
import { computeItemStats } from "@/lib/data/document-requests";
import { friendlyDocumentRequestStatusMeta } from "@/lib/portal-copy";
import { formatDate } from "@/lib/utils";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";

export default async function PortalDocumentRequestsPage() {
  const { client } = await requirePortalAccess();
  if (!client) return <PortalNotLinkedState />;

  const supabase = await createClient();
  const requests = await listPortalDocumentRequests(supabase, client.client.id);

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Document Requests" description="Everything your tax office has asked for." />

      {requests.length === 0 ? (
        <PortalEmptyState icon={ClipboardList} title="No document requests yet" />
      ) : (
        <div className="space-y-3">
          {requests.map((request) => {
            const status = friendlyDocumentRequestStatusMeta(request.status);
            const stats = computeItemStats(request.items);
            return (
              <Link key={request.id} href={`/portal/document-requests/${request.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardBody className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{request.title}</p>
                        <p className="text-xs text-muted">
                          {request.engagement?.tax_year ? `Tax year ${request.engagement.tax_year} · ` : ""}
                          Due {formatDate(request.due_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge label={status.label} tone={status.tone} />
                        <ArrowRight className="size-4 text-slate-400" />
                      </div>
                    </div>
                    <DocumentRequestProgress received={stats.received} total={stats.total} />
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
