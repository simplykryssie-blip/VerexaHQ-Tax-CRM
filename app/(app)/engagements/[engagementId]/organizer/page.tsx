import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/LegacyButton";
import { IntakeReviewWorkspace } from "@/components/intakes/IntakeReviewWorkspace";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function EngagementOrganizerReviewPage({
  params,
}: {
  params: Promise<{ engagementId: string }>;
}) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const { engagementId } = await params;
  const supabase = await createClient();

  const { data: submission } = await supabase
    .from("intake_submissions")
    .select("id")
    .eq("workspace_id", workspace.workspace.id)
    .eq("engagement_id", engagementId)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .maybeSingle();

  if (!submission) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizer review"
        description="Answers, documents, and clarifications for this engagement's tax organizer."
        actions={
          <Link href={`/engagements/${engagementId}`}>
            <Button size="sm" variant="secondary">
              <ArrowLeft className="size-4" />
              Back to engagement
            </Button>
          </Link>
        }
      />
      <IntakeReviewWorkspace workspaceId={workspace.workspace.id} role={workspace.role} submissionId={submission.id} />
    </div>
  );
}
