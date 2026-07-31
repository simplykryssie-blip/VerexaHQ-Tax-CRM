import { requireWorkspaceRole } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { STAFF_ROLES } from "@/lib/types";
import { listClientsForPicker } from "@/lib/data/engagements";
import { listWorkspaceStaff } from "@/lib/data/users";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { EngagementForm } from "@/components/engagements/EngagementForm";

export default async function NewEngagementPage() {
  const { allowed, workspace } = await requireWorkspaceRole(STAFF_ROLES);
  if (!allowed || !workspace) {
    return <ForbiddenState description="You don't have permission to create engagements." />;
  }

  const supabase = await createClient();
  const [clients, staff] = await Promise.all([
    listClientsForPicker(supabase, workspace.workspace.id),
    listWorkspaceStaff(supabase, workspace.workspace.id),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="New engagement" description="Create a tax engagement for a client." />
      <Card>
        <CardBody>
          <EngagementForm clients={clients} staff={staff} />
        </CardBody>
      </Card>
    </div>
  );
}
