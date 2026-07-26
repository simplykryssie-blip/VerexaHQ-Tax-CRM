import { notFound } from "next/navigation";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { getPortalIntakeDetail } from "@/lib/data/portal-intakes";
import { OrganizerWizard } from "@/components/portal/organizer/OrganizerWizard";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";

export default async function PortalOrganizerPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const { client } = await requirePortalAccess();
  if (!client) return <PortalNotLinkedState />;

  const { assignmentId } = await params;
  const supabase = await createClient();
  const detail = await getPortalIntakeDetail(supabase, client.client.id, assignmentId);
  if (!detail) notFound();

  return (
    <OrganizerWizard detail={detail} workspaceId={client.client.workspace_id} clientId={client.client.id} />
  );
}
