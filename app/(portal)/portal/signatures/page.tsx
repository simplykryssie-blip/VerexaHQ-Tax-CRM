import { PenTool } from "lucide-react";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/formatters";

export default async function PortalSignaturesPage() {
  const { client } = await requirePortalAccess(); if (!client) return null;
  const supabase = await createClient();
  const { data: requests } = await supabase.from("signature_requests").select("id,title,message,status,sent_at,expires_at,completed_at").eq("client_id", client.client.id).neq("status", "draft").order("created_at", { ascending: false });
  return <div className="space-y-6"><PortalPageHeader title="Signatures" description="Track engagement letters and ordinary documents sent for signature." /><div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">Form 8879/KBA identity verification is not enabled until your tax office connects an approved provider.</div>{!requests?.length ? <PortalEmptyState icon={PenTool} title="No signature requests" /> : <div className="space-y-3">{requests.map((request) => <Card key={request.id}><CardBody className="flex items-start justify-between gap-3"><div><p className="font-semibold">{request.title}</p>{request.message && <p className="mt-1 text-sm text-muted">{request.message}</p>}<p className="mt-2 text-xs text-muted">Sent {formatDate(request.sent_at)}{request.expires_at ? ` · Expires ${formatDate(request.expires_at)}` : ""}</p></div><StatusBadge label={request.status.replaceAll("_", " ")} tone={request.status === "completed" ? "success" : request.status === "declined" || request.status === "expired" ? "danger" : "info"} /></CardBody></Card>)}</div>}</div>;
}
