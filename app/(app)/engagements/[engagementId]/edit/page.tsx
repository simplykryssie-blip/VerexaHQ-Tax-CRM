import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { getEngagementDetail } from "@/lib/data/engagements";
import { STAFF_ROLES } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";
import { EngagementEditForm } from "@/components/engagements/EngagementEditForm";

export default async function EditEngagementPage({
  params,
}: {
  params: Promise<{ engagementId: string }>;
}) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;
  if (!STAFF_ROLES.includes(workspace.role)) {
    return <ForbiddenState description="You don't have permission to edit engagements." />;
  }

  const { engagementId } = await params;
  const supabase = await createClient();
  const detail = await getEngagementDetail(supabase, workspace.workspace.id, engagementId);
  if (!detail) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title={`Edit ${detail.engagement.title}`} description={detail.engagement.engagement_number} />
      <Card>
        <CardBody>
          <EngagementEditForm engagement={detail.engagement} />
        </CardBody>
      </Card>
    </div>
  );
}
