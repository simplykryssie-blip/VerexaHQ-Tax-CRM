import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { getOrganizerTemplateDetail } from "@/lib/data/organizer-templates";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/LegacyButton";
import { Card, CardBody, CardHeader } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CloneOrganizerTemplateButton } from "@/components/settings/CloneOrganizerTemplateButton";
import { PublishTemplateVersionButton } from "@/components/settings/PublishTemplateVersionButton";
import { SetTemplateStatusButton } from "@/components/settings/SetTemplateStatusButton";
import { templateStatusMeta } from "@/lib/status";
import { formatDate, formatDateTime, titleCase } from "@/lib/utils";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function OrganizerTemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const { templateId } = await params;
  const supabase = await createClient();
  const detail = await getOrganizerTemplateDetail(supabase, workspace.workspace.id, templateId);
  if (!detail) notFound();

  const { template, versions, activeAssignmentCount, canManage } = detail;
  const status = templateStatusMeta(template.status);
  const metadata = (template.metadata as Record<string, unknown>) ?? {};
  const taxForm = typeof metadata.tax_form === "string" ? metadata.tax_form : null;
  const engagementType = typeof metadata.engagement_type === "string" ? metadata.engagement_type : null;

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={template.name}
        description={template.description ?? "Organizer template"}
        actions={
          <Link href="/settings/organizers">
            <Button size="sm" variant="secondary">
              <ArrowLeft className="size-4" />
              Back to templates
            </Button>
          </Link>
        }
      />

      <Card>
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Template details</h2>
          <StatusBadge label={status.label} tone={status.tone} />
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Type</p>
              <p className="text-sm text-foreground">{template.is_system_template ? "System template" : "Workspace template"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Return type</p>
              <p className="text-sm text-foreground">{taxForm ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Engagement type</p>
              <p className="text-sm text-foreground">{engagementType ? titleCase(engagementType) : "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Active assignments</p>
              <p className="text-sm text-foreground">{activeAssignmentCount}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Category</p>
              <p className="text-sm text-foreground">{template.category ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Last updated</p>
              <p className="text-sm text-foreground">{formatDate(template.updated_at)}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <CloneOrganizerTemplateButton templateId={template.id} />
            {canManage && template.status !== "archived" && (
              <SetTemplateStatusButton templateId={template.id} targetStatus="archived" />
            )}
            {canManage && template.status === "archived" && (
              <SetTemplateStatusButton templateId={template.id} targetStatus="published" />
            )}
          </div>
          {!canManage && (
            <p className="text-xs text-muted">
              This is a shared system template. Clone it to create an editable copy owned by your workspace.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Versions</h2>
        </CardHeader>
        <CardBody className="p-0">
          {versions.length === 0 ? (
            <p className="p-5 text-sm text-muted">No versions yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {versions.map((version) => {
                const versionMeta = templateStatusMeta(version.status);
                const isCurrent = template.current_version_id === version.id;
                return (
                  <li key={version.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        v{version.version_number}
                        {isCurrent && <span className="ml-2 text-xs font-normal text-muted">(current draft)</span>}
                        {template.latest_published_version_id === version.id && (
                          <span className="ml-2 text-xs font-normal text-muted">(latest published)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted">
                        {version.change_summary || "No change summary"} · Created{" "}
                        {formatDateTime(version.created_at)}
                        {version.published_at ? ` · Published ${formatDateTime(version.published_at)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge label={versionMeta.label} tone={versionMeta.tone} />
                      {canManage && version.status === "draft" && (
                        <PublishTemplateVersionButton templateId={template.id} versionId={version.id} />
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
