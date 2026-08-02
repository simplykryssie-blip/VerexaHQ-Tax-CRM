import { CalendarDays, MapPin, Video } from "lucide-react";
import { requirePortalAccess } from "@/lib/auth/portal";
import { getPortalAppointments } from "@/features/portal/queries";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateTime } from "@/lib/formatters";

export default async function PortalAppointmentsPage() {
  const { client } = await requirePortalAccess(); if (!client) return null;
  const appointments = await getPortalAppointments(client.client.id);
  return <div className="space-y-6"><PortalPageHeader title="Appointments" description="Your scheduled meetings, locations, and video links." />{appointments.length === 0 ? <PortalEmptyState icon={CalendarDays} title="No appointments scheduled" /> : <div className="space-y-3">{appointments.map((item) => { const zoom = item.zoom_meeting as { join_url?: string | null } | null; return <Card key={item.id}><CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{item.title}</p><p className="text-sm text-muted">{formatDateTime(item.starts_at)} – {formatDateTime(item.ends_at)}</p>{item.location_text && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><MapPin className="size-3.5" />{item.location_text}</p>}{item.client_notes && <p className="mt-2 text-sm">{item.client_notes}</p>}</div><div className="flex items-center gap-2"><StatusBadge label={item.status} tone={item.status === "confirmed" ? "success" : "info"} />{zoom?.join_url && <a className="inline-flex items-center gap-1 rounded-md bg-accent-600 px-3 py-2 text-xs font-medium text-white" href={zoom.join_url} target="_blank" rel="noreferrer"><Video className="size-3.5" />Join</a>}</div></CardBody></Card>; })}</div>}</div>;
}
