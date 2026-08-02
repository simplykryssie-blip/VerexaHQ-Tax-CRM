import { Bell } from "lucide-react";
import { requirePortalAccess } from "@/lib/auth/portal";
import { getPortalNotifications } from "@/features/portal/queries";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { formatDateTime } from "@/lib/formatters";

export default async function PortalNotificationsPage() {
  const { client } = await requirePortalAccess(); if (!client) return null;
  const notifications = await getPortalNotifications(client.client.id);
  return <div className="space-y-6"><PortalPageHeader title="Notifications" description="Updates and required actions from your tax office." />{notifications.length === 0 ? <PortalEmptyState icon={Bell} title="No notifications" /> : <div className="space-y-3">{notifications.map((item) => <Card key={item.id}><CardBody className={item.is_read ? "" : "border-l-4 border-l-accent-600"}><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm text-muted">{item.message}</p><p className="mt-2 text-xs text-muted">{formatDateTime(item.created_at)}</p></CardBody></Card>)}</div>}</div>;
}
