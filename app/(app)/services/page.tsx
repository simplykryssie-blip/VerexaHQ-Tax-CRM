import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/permissions/granular";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { ServicePackageManager, type ServicePackageSummary } from "@/features/service-packages/service-package-manager";
import { getLeadCatalogOptions } from "@/features/leads/queries";

export default async function ServicesPage() {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <ForbiddenState description="Select a workspace to manage service packages." />;

  const access = await requirePermission(workspace.workspace.id, "service_packages.view");
  if (!access.allowed) return <ForbiddenState description={access.reason} />;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("engagement_type_settings")
    .select(`
      *,
      workflow:workflow_definitions!engagement_type_settings_primary_workflow_definition_id_fkey(name),
      organizer:templates!engagement_type_settings_organizer_template_id_fkey(name),
      letter:templates!engagement_type_settings_engagement_letter_template_id_fkey(name),
      checklist:templates!engagement_type_settings_document_checklist_template_id_fkey(name),
      serviceOffering:service_offerings!engagement_type_settings_service_offering_id_fkey(id, name)
    `)
    .eq("workspace_id", workspace.workspace.id)
    .is("archived_at", null)
    .order("is_active", { ascending: false })
    .order("sort_order")
    .order("name");

  if (error) throw error;

  const [createAccess, editAccess, duplicateAccess, deactivateAccess, { serviceOfferings }] = await Promise.all([
    requirePermission(workspace.workspace.id, "service_packages.create"),
    requirePermission(workspace.workspace.id, "service_packages.edit"),
    requirePermission(workspace.workspace.id, "service_packages.duplicate"),
    requirePermission(workspace.workspace.id, "service_packages.deactivate"),
    getLeadCatalogOptions(workspace.workspace.id),
  ]);

  return (
    <ServicePackageManager
      packages={(data ?? []) as ServicePackageSummary[]}
      serviceOfferings={serviceOfferings}
      permissions={{
        create: createAccess.allowed,
        edit: editAccess.allowed,
        duplicate: duplicateAccess.allowed,
        deactivate: deactivateAccess.allowed,
      }}
    />
  );
}
