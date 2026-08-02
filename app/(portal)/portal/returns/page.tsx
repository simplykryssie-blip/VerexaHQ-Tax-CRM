import { FileCheck2 } from "lucide-react";
import { requirePortalAccess } from "@/lib/auth/portal";
import { getPortalCompletedReturns } from "@/features/portal/queries";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/formatters";

export default async function PortalReturnsPage() {
  const { client } = await requirePortalAccess(); if (!client) return null;
  const returns = await getPortalCompletedReturns(client.client.id);
  return <div className="space-y-6"><PortalPageHeader title="Completed Returns" description="Returns appear here only after your tax office clears every release requirement." />{returns.length === 0 ? <PortalEmptyState icon={FileCheck2} title="No completed returns released yet" description="Your progress remains available under Engagements." /> : <div className="space-y-3">{returns.map((item) => <Card key={item.id}><CardBody className="flex items-center justify-between gap-3"><div><p className="font-semibold">{item.engagement?.title || item.engagement?.engagement_number || "Completed tax return"}</p><p className="text-xs text-muted">Tax year {item.engagement?.tax_year ?? "—"} · Released {formatDate(item.released_at)}</p>{item.release_notes && <p className="mt-2 text-sm">{item.release_notes}</p>}</div><StatusBadge label="Released" tone="success" /></CardBody></Card>)}</div>}</div>;
}
