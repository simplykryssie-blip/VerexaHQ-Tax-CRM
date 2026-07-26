import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { getEngagementDetail } from "@/lib/data/engagements";
import { listWorkspaceStaff } from "@/lib/data/users";
import { REVIEW_ROLES, MANAGE_ROLES, STAFF_ROLES } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Tabs, type TabDefinition } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EngagementOverviewTab } from "@/components/engagements/EngagementOverviewTab";
import { EngagementWorkflowTab } from "@/components/engagements/EngagementWorkflowTab";
import { EngagementDocumentsTab } from "@/components/engagements/EngagementDocumentsTab";
import { EngagementIntakeTab } from "@/components/engagements/EngagementIntakeTab";
import { EngagementNotesTab } from "@/components/engagements/EngagementNotesTab";
import { EngagementActivityList } from "@/components/engagements/EngagementActivityList";
import { engagementStatusMeta } from "@/lib/status";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function EngagementDetailPage({
  params,
}: {
  params: Promise<{ engagementId: string }>;
}) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const { engagementId } = await params;
  const supabase = await createClient();
  const detail = await getEngagementDetail(supabase, workspace.workspace.id, engagementId);
  if (!detail) notFound();

  const staff = await listWorkspaceStaff(supabase, workspace.workspace.id);
  const canManage = REVIEW_ROLES.includes(workspace.role) || STAFF_ROLES.includes(workspace.role);
  const canArchive = MANAGE_ROLES.includes(workspace.role);
  const statusMeta = engagementStatusMeta(detail.engagement.status);

  const tabs: TabDefinition[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <EngagementOverviewTab
          engagement={detail.engagement}
          client={detail.client}
          preparer={detail.preparer}
          reviewer={detail.reviewer}
          responsibleStaff={detail.responsibleStaff}
        />
      ),
    },
    {
      id: "workflow",
      label: "Workflow",
      content: (
        <EngagementWorkflowTab
          engagement={detail.engagement}
          staff={staff}
          canManage={canManage}
          canArchive={canArchive}
        />
      ),
    },
    {
      id: "documents",
      label: "Documents",
      content: <EngagementDocumentsTab documents={detail.documents} documentRequest={detail.documentRequest} />,
    },
    {
      id: "intake",
      label: "Intake & Clarifications",
      content: (
        <EngagementIntakeTab
          intakeSubmissions={detail.intakeSubmissions}
          openClarificationsCount={detail.openClarificationsCount}
        />
      ),
    },
    {
      id: "notes",
      label: "Notes",
      content: <EngagementNotesTab engagementId={engagementId} notes={detail.notes} userMap={detail.userMap} />,
    },
    {
      id: "activity",
      label: "Activity",
      content: (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Activity history</h2>
          </CardHeader>
          <CardBody>
            <EngagementActivityList activity={detail.activity} userMap={detail.userMap} />
          </CardBody>
        </Card>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.engagement.title}
        description={
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs">{detail.engagement.engagement_number}</span>
            <StatusBadge label={statusMeta.label} tone={statusMeta.tone} />
          </span>
        }
        actions={
          <Link href={`/engagements/${engagementId}/edit`}>
            <Button size="sm" variant="secondary">
              <Pencil className="size-4" />
              Edit
            </Button>
          </Link>
        }
      />

      <Tabs tabs={tabs} />
    </div>
  );
}
