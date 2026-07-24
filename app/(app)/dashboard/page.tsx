import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/data/dashboard";
import { PageHeader } from "@/components/ui/PageHeader";
import { MetricsGrid } from "@/components/dashboard/MetricsGrid";
import { RecentClientsCard } from "@/components/dashboard/RecentClientsCard";
import { IntakesNeedingAttentionCard } from "@/components/dashboard/IntakesNeedingAttentionCard";
import { DocumentRequestsDueCard } from "@/components/dashboard/DocumentRequestsDueCard";
import { RecentReviewActivityCard } from "@/components/dashboard/RecentReviewActivityCard";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function DashboardPage() {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const supabase = await createClient();
  const data = await getDashboardData(supabase, workspace.workspace.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Overview for ${workspace.workspace.name}`}
      />

      <MetricsGrid metrics={data.metrics} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <RecentClientsCard clients={data.recentClients} />
        <IntakesNeedingAttentionCard intakes={data.intakesNeedingAttention} />
        <DocumentRequestsDueCard requests={data.documentRequestsDue} />
        <RecentReviewActivityCard activity={data.recentReviewActivity} />
      </div>
    </div>
  );
}
