import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { getPortalDashboardData } from "@/lib/data/portal-dashboard";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalDashboardMetrics } from "@/components/portal/dashboard/PortalDashboardMetrics";
import { PortalOrganizerCard } from "@/components/portal/dashboard/PortalOrganizerCard";
import { PortalNextActionCard } from "@/components/portal/dashboard/PortalNextActionCard";
import { PortalActionCardsGrid } from "@/components/portal/dashboard/PortalActionCardsGrid";
import { PortalActivityTimeline } from "@/components/portal/PortalActivityTimeline";
import { Card, CardHeader, CardBody } from "@/components/ui/LegacyCard";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";
import { clientDisplayName } from "@/lib/utils";

export default async function PortalDashboardPage() {
  const { client } = await requirePortalAccess();
  if (!client) return <PortalNotLinkedState />;

  const supabase = await createClient();
  const data = await getPortalDashboardData(supabase, client.client.id);

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title={`Welcome, ${clientDisplayName(client.client)}`}
        description="Here's where things stand with your taxes."
      />

      <PortalOrganizerCard organizer={data.currentIntake} />

      <PortalNextActionCard action={data.nextAction} />

      <PortalDashboardMetrics data={data} />

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Quick actions</h2>
        <PortalActionCardsGrid data={data} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Recent activity</h2>
        </CardHeader>
        <CardBody>
          <PortalActivityTimeline items={data.recentActivity} />
        </CardBody>
      </Card>
    </div>
  );
}
