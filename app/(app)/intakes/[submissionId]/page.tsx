import { requireWorkspace } from "@/lib/auth/workspace";
import { PageHeader } from "@/components/ui/PageHeader";
import { IntakeReviewWorkspace } from "@/components/intakes/IntakeReviewWorkspace";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function IntakeDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const { submissionId } = await params;

  return (
    <div className="space-y-6">
      <PageHeader title="Intake detail" description="Reviewer notes, answers, and clarifications for this submission." />
      <IntakeReviewWorkspace workspaceId={workspace.workspace.id} role={workspace.role} submissionId={submissionId} />
    </div>
  );
}
