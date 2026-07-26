import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Template, TemplateVersion } from "@/lib/types";

export type OrganizerTemplateListItem = {
  id: string;
  name: string;
  status: Template["status"];
  category: string | null;
  isSystemTemplate: boolean;
  workspaceId: string | null;
  taxForm: string | null;
  engagementType: string | null;
  currentVersionNumber: number | null;
  activeAssignmentCount: number;
  updatedAt: string;
};

/**
 * Templates visible to a workspace's organizer picker: global system
 * templates (workspace_id null) plus any this workspace has cloned for
 * itself — the same `templates` table the client-facing organizer and
 * assignment flow already read from, not a separate catalog.
 */
export async function listOrganizerTemplates(
  supabase: SupabaseServerClient,
  workspaceId: string,
): Promise<OrganizerTemplateListItem[]> {
  const { data: templates } = await supabase
    .from("templates")
    .select("*")
    .eq("kind", "form")
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
    .order("name");

  const rows = templates ?? [];
  if (rows.length === 0) return [];

  const versionIds = rows.map((t) => t.current_version_id).filter((id): id is string => Boolean(id));

  const [versionsResult, assignmentsResult] = await Promise.all([
    versionIds.length > 0
      ? supabase.from("template_versions").select("id, version_number").in("id", versionIds)
      : Promise.resolve({ data: [] as Pick<TemplateVersion, "id" | "version_number">[] }),
    supabase
      .from("intake_submissions")
      .select("template_id")
      .in(
        "template_id",
        rows.map((t) => t.id),
      )
      .neq("status", "archived"),
  ]);

  const versionNumberByVersionId = new Map((versionsResult.data ?? []).map((v) => [v.id, v.version_number]));
  const activeCountByTemplateId = new Map<string, number>();
  for (const row of assignmentsResult.data ?? []) {
    activeCountByTemplateId.set(row.template_id, (activeCountByTemplateId.get(row.template_id) ?? 0) + 1);
  }

  return rows.map((t) => {
    const metadata = (t.metadata as Record<string, unknown>) ?? {};
    return {
      id: t.id,
      name: t.name,
      status: t.status,
      category: t.category,
      isSystemTemplate: t.is_system_template,
      workspaceId: t.workspace_id,
      taxForm: typeof metadata.tax_form === "string" ? metadata.tax_form : null,
      engagementType: typeof metadata.engagement_type === "string" ? metadata.engagement_type : null,
      currentVersionNumber: t.current_version_id ? versionNumberByVersionId.get(t.current_version_id) ?? null : null,
      activeAssignmentCount: activeCountByTemplateId.get(t.id) ?? 0,
      updatedAt: t.updated_at,
    };
  });
}

export type OrganizerTemplateDetail = {
  template: Template;
  versions: TemplateVersion[];
  activeAssignmentCount: number;
  canManage: boolean;
};

export async function getOrganizerTemplateDetail(
  supabase: SupabaseServerClient,
  workspaceId: string,
  templateId: string,
): Promise<OrganizerTemplateDetail | null> {
  const { data: template } = await supabase
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .eq("kind", "form")
    .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
    .maybeSingle();

  if (!template) return null;

  const [versionsResult, assignmentsResult] = await Promise.all([
    supabase
      .from("template_versions")
      .select("*")
      .eq("template_id", templateId)
      .order("version_number", { ascending: false }),
    supabase
      .from("intake_submissions")
      .select("id", { count: "exact", head: true })
      .eq("template_id", templateId)
      .neq("status", "archived"),
  ]);

  return {
    template,
    versions: versionsResult.data ?? [],
    activeAssignmentCount: assignmentsResult.count ?? 0,
    canManage: template.workspace_id === workspaceId,
  };
}
