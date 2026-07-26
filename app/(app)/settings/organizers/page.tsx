import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { listOrganizerTemplates, type OrganizerTemplateListItem } from "@/lib/data/organizer-templates";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CreateOrganizerTemplateDialog } from "@/components/settings/CreateOrganizerTemplateDialog";
import { templateStatusMeta } from "@/lib/status";
import { formatDate, titleCase } from "@/lib/utils";
import { MANAGE_ROLES } from "@/lib/types";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

export default async function OrganizerTemplatesPage() {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const supabase = await createClient();
  const templates = await listOrganizerTemplates(supabase, workspace.workspace.id);
  const canManage = MANAGE_ROLES.includes(workspace.role);

  const columns: DataTableColumn<OrganizerTemplateListItem>[] = [
    {
      key: "name",
      header: "Template",
      render: (t) => (
        <div>
          <p className="font-medium text-foreground">{t.name}</p>
          <p className="text-xs text-muted">{t.isSystemTemplate ? "System template" : "Workspace template"}</p>
        </div>
      ),
    },
    { key: "returnType", header: "Return type", render: (t) => t.taxForm ?? "—" },
    { key: "engagementType", header: "Engagement type", render: (t) => (t.engagementType ? titleCase(t.engagementType) : "—") },
    { key: "version", header: "Version", render: (t) => (t.currentVersionNumber ? `v${t.currentVersionNumber}` : "—") },
    {
      key: "status",
      header: "Status",
      render: (t) => {
        const meta = templateStatusMeta(t.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    { key: "assignments", header: "Active assignments", render: (t) => t.activeAssignmentCount },
    { key: "updated", header: "Last updated", render: (t) => formatDate(t.updatedAt) },
    {
      key: "action",
      header: "",
      className: "text-right",
      render: (t) => (
        <Link
          href={`/settings/organizers/${t.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 hover:underline"
        >
          Open <ArrowRight className="size-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Organizer templates"
        description="Manage the tax organizer templates clients and staff use across engagements."
        actions={canManage ? <CreateOrganizerTemplateDialog /> : undefined}
      />

      <Card>
        {templates.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={ClipboardList} title="No organizer templates found" description="Create one to get started." />
          </div>
        ) : (
          <DataTable columns={columns} rows={templates} rowKey={(t) => t.id} />
        )}
      </Card>
    </div>
  );
}
