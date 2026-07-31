import { requireWorkspaceRole } from "@/lib/auth/workspace";
import { STAFF_ROLES } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { ClientForm } from "@/components/clients/ClientForm";

export default async function NewClientPage() {
  const { allowed } = await requireWorkspaceRole(STAFF_ROLES);
  if (!allowed) return <ForbiddenState description="You don't have permission to add clients." />;

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
