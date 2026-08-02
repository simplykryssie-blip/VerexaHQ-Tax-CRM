import Link from "next/link";
import { LayoutTemplate, ArrowRight } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { getTemplates } from "@/features/templates/queries";
import { NewTemplateDialog } from "@/features/templates/new-template-dialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { templateKindLabel, templateStatusLabel } from "@/lib/validation/templates";
import { formatDate } from "@/lib/formatters";

const FILTERS = [
  ["", "All"],
  ["form", "Organizers & forms"],
  ["engagement", "Engagement letters"],
  ["document_request", "Document requests"],
  ["message", "Messages"],
  ["checklist", "Checklists"],
  ["service_package", "Service packages"],
] as const;

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;
  const access = await requirePermission(workspace.workspace.id, "templates.manage");
  if (!access.allowed) return <ForbiddenState description={access.reason} />;

  const { kind } = await searchParams;
  const templates = await getTemplates(workspace.workspace.id, { kind: kind || undefined });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates & forms"
        description="Preview complete templates, create editable copies, publish versions, and control what staff can assign."
        actions={<NewTemplateDialog workspaceId={workspace.workspace.id} />}
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([value, label]) => (
          <Button key={value || "all"} asChild size="sm" variant={(kind ?? "") === value ? "secondary" : "ghost"}>
            <Link href={value ? `/templates?kind=${value}` : "/templates"}>{label}</Link>
          </Button>
        ))}
      </div>

      {templates.length === 0 ? (
        <Card><CardBody><EmptyState icon={LayoutTemplate} title="No templates found" description="Create a template or choose another filter." /></CardBody></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id}>
              <CardBody className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{template.name}</p>
                    <p className="text-sm text-muted">{template.description || "No description"}</p>
                  </div>
                  <StatusBadge label={templateStatusLabel(template.status)} tone={template.status === "published" ? "success" : template.status === "archived" ? "neutral" : "warning"} />
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                  <span>{templateKindLabel(template.kind)}</span>
                  <span>{template.is_system_template ? "Verexa template" : "Workspace template"}</span>
                  <span>Updated {formatDate(template.updated_at)}</span>
                </div>
                <Link href={`/templates/${template.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 hover:underline">
                  Preview or edit <ArrowRight className="size-3.5" />
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
