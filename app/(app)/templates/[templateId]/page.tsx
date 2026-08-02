import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { getTemplateDetail } from "@/features/templates/queries";
import { TemplateDetailPanel } from "@/features/templates/template-detail-panel";
import { PageHeader } from "@/components/ui/PageHeader";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";
import { Button } from "@/components/ui/button";

export default async function TemplateDetailPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;
  const access = await requirePermission(workspace.workspace.id, "templates.manage");
  if (!access.allowed) return <ForbiddenState description={access.reason} />;

  const { templateId } = await params;
  const { template, versions } = await getTemplateDetail(templateId);
  if (!template) notFound();

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        title="Template workspace"
        description="View the full client experience before sending, or edit a workspace-owned draft."
        actions={<Button asChild variant="outline" size="sm"><Link href="/templates"><ArrowLeft className="size-4" /> Back to templates</Link></Button>}
      />
      <TemplateDetailPanel template={template} versions={versions} workspaceId={workspace.workspace.id} />
    </div>
  );
}
