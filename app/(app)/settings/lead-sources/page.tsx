import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions/granular";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { Button } from "@/components/ui/LegacyButton";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";
import { LeadSourcesManager } from "@/features/settings/lead-sources-manager";

export default async function LeadSourcesSettingsPage() {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;
  const access = await requirePermission(workspace.workspace.id, "lead_sources.manage");
  if (!access.allowed) return <ForbiddenState description={access.reason} />;

  const supabase = await createClient();
  const { data: sources } = await supabase
    .from("lead_sources")
    .select("*")
    .or(`workspace_id.is.null,workspace_id.eq.${workspace.workspace.id}`)
    .order("sort_order");

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Lead sources"
        description="Manage the source options shown when staff add a lead."
        actions={
          <Link href="/settings">
            <Button size="sm" variant="secondary">
              <ArrowLeft className="size-4" /> Back to settings
            </Button>
          </Link>
        }
      />
      <Card>
        <CardBody>
          <LeadSourcesManager workspaceId={workspace.workspace.id} sources={sources ?? []} />
        </CardBody>
      </Card>
    </div>
  );
}
