import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { ClientForm } from "@/components/clients/ClientForm";

export default async function NewClientPage() {
  const {workspace}=await requireWorkspace();
  if(!workspace)return <ForbiddenState description="Select a workspace first."/>;
  const access=await requirePermission(workspace.workspace.id,"clients.create");
  if (!access.allowed) return <ForbiddenState description={access.reason} />;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Add client" description="Create a new client record for your workspace." />
      <Card>
        <CardBody>
          <ClientForm />
        </CardBody>
      </Card>
    </div>
  );
}
