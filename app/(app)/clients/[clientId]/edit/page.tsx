import { notFound } from "next/navigation";
import { requireWorkspaceRole } from "@/lib/auth/workspace";
import { STAFF_ROLES } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { getClientDetail } from "@/lib/data/clients";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";
import { ClientForm } from "@/components/clients/ClientForm";
import { clientDisplayName } from "@/lib/utils";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { allowed, workspace } = await requireWorkspaceRole(STAFF_ROLES);
  if (!workspace) return <NoWorkspaceState />;
  if (!allowed) return <ForbiddenState description="You don't have permission to edit clients." />;

  const { clientId } = await params;
  const supabase = await createClient();
  const detail = await getClientDetail(supabase, workspace.workspace.id, clientId);
  if (!detail) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={`Edit ${clientDisplayName(detail.client)}`} description="Update this client's record." />
      <Card>
        <CardBody>
          <ClientForm client={detail.client} />
        </CardBody>
      </Card>
    </div>
  );
}
