import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { listClientsForPicker } from "@/lib/data/engagements";
import { defaultReviewerFor, listWorkspaceStaff } from "@/lib/data/users";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { EngagementForm } from "@/components/engagements/EngagementForm";
import { requirePermission } from "@/lib/permissions/granular";

export default async function NewEngagementPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const { workspace, user } = await requireWorkspace();
  if (!workspace) return <ForbiddenState description="Select a workspace to create an engagement." />;
  const access = await requirePermission(workspace.workspace.id, "engagements.create");
  if (!access.allowed) return <ForbiddenState description={access.reason} />;

  const supabase = await createClient();
  const params = await searchParams;
  const [clients, staff, packageResult] = await Promise.all([
    listClientsForPicker(supabase, workspace.workspace.id),
    listWorkspaceStaff(supabase, workspace.workspace.id),
    supabase.from("engagement_type_settings").select("id,name,engagement_type,return_type,pricing_method,reviewer_policy,activation_default,is_active,primary_workflow_definition_id,organizer_template_id,engagement_letter_template_id,document_checklist_template_id").eq("workspace_id", workspace.workspace.id).eq("is_active", true).order("name"),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="New engagement" description="Create a tax engagement for a client." />
      <Card>
        <CardBody>
          <EngagementForm
            clients={clients}
            staff={staff}
            initialClientId={clients.some((client) => client.id === params.clientId) ? params.clientId : undefined}
            defaultReviewerId={defaultReviewerFor(staff, user.id, workspace.role)}
            reviewerLocked={workspace.role === "preparer"}
            servicePackages={packageResult.data ?? []}
          />
        </CardBody>
      </Card>
    </div>
  );
}
