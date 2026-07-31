import { createClient } from "@/lib/supabase/client";
import type { Tables } from "@/types/database";

type TemplateRow = Tables<"templates">;
type VersionRow = Tables<"template_versions">;

/**
 * Copies a system template (workspace_id null, not editable by staff) into a
 * new workspace-owned template staff can edit — templates.source_template_id
 * and original_workspace_id already exist in the schema for exactly this.
 * RLS blocks staff from writing to the original (can_manage_template requires
 * workspace_id to match their own), so this is the only path to "editable".
 */
export async function customizeSystemTemplate(
  template: TemplateRow,
  sourceVersion: VersionRow,
  workspaceId: string,
): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: newTemplate, error: templateError } = await supabase
    .from("templates")
    .insert({
      workspace_id: workspaceId,
      kind: template.kind,
      name: template.name,
      description: template.description,
      category: template.category,
      visibility: "workspace",
      status: "published",
      is_system_template: false,
      source_template_id: template.id,
      metadata: template.metadata,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (templateError || !newTemplate) throw new Error(templateError?.message ?? "Could not create the customized template.");

  const { data: newVersion, error: versionError } = await supabase
    .from("template_versions")
    .insert({
      template_id: newTemplate.id,
      version_number: 1,
      status: "published",
      name: sourceVersion.name,
      description: sourceVersion.description,
      content: sourceVersion.content,
      published_at: new Date().toISOString(),
      published_by: user?.id ?? null,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (versionError || !newVersion) throw new Error(versionError?.message ?? "Could not create the first version.");

  if (template.kind === "form") {
    await copyFormStructure(supabase, sourceVersion.id, newVersion.id);
  }

  const { error: linkError } = await supabase
    .from("templates")
    .update({ current_version_id: newVersion.id, latest_published_version_id: newVersion.id })
    .eq("id", newTemplate.id);
  if (linkError) throw new Error(linkError.message);

  return newTemplate.id as string;
}

async function copyFormStructure(supabase: ReturnType<typeof createClient>, sourceVersionId: string, newVersionId: string) {
  const { data: sections } = await supabase
    .from("form_sections")
    .select("*")
    .eq("template_version_id", sourceVersionId)
    .order("sort_order");

  const sectionIdByKey = new Map<string, string>();
  if (sections && sections.length > 0) {
    const payload = sections.map((s) => ({
      template_version_id: newVersionId,
      parent_section_id: null,
      title: s.title,
      description: s.description,
      section_key: s.section_key,
      sort_order: s.sort_order,
      is_repeatable: s.is_repeatable,
      min_repetitions: s.min_repetitions,
      max_repetitions: s.max_repetitions,
      is_locked: s.is_locked,
      settings: s.settings,
    }));
    const { data: inserted, error } = await supabase.from("form_sections").insert(payload).select("id, section_key");
    if (error) throw new Error(error.message);
    for (const row of inserted ?? []) sectionIdByKey.set(row.section_key, row.id);

    const parentUpdates = sections
      .filter((s) => s.parent_section_id)
      .map((s) => {
        const oldParent = sections.find((p) => p.id === s.parent_section_id);
        if (!oldParent) return null;
        const newSelfId = sectionIdByKey.get(s.section_key);
        const newParentId = sectionIdByKey.get(oldParent.section_key);
        if (!newSelfId || !newParentId) return null;
        return supabase.from("form_sections").update({ parent_section_id: newParentId }).eq("id", newSelfId);
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
    await Promise.all(parentUpdates);
  }

  const { data: fields } = await supabase
    .from("form_fields")
    .select("*")
    .eq("template_version_id", sourceVersionId)
    .order("sort_order");

  const fieldIdByKey = new Map<string, string>();
  if (fields && fields.length > 0) {
    const oldSectionById = new Map(sections?.map((s) => [s.id, s]) ?? []);
    const payload = fields.map((f) => ({
      template_version_id: newVersionId,
      section_id: f.section_id ? (sectionIdByKey.get(oldSectionById.get(f.section_id)?.section_key ?? "") ?? null) : null,
      field_key: f.field_key,
      component_type: f.component_type,
      label: f.label,
      description: f.description,
      placeholder: f.placeholder,
      help_text: f.help_text,
      default_value: f.default_value,
      options: f.options,
      validation: f.validation,
      settings: f.settings,
      is_required: f.is_required,
      is_staff_only: f.is_staff_only,
      is_locked: f.is_locked,
      sort_order: f.sort_order,
    }));
    const { data: inserted, error } = await supabase.from("form_fields").insert(payload).select("id, field_key");
    if (error) throw new Error(error.message);
    for (const row of inserted ?? []) fieldIdByKey.set(row.field_key, row.id);
  }

  const { data: conditions } = await supabase.from("form_conditions").select("*").eq("template_version_id", sourceVersionId);
  if (conditions && conditions.length > 0) {
    const oldFieldById = new Map(fields?.map((f) => [f.id, f]) ?? []);
    const oldSectionById = new Map(sections?.map((s) => [s.id, s]) ?? []);
    const payload = conditions
      .map((c) => {
        const newSourceFieldId = fieldIdByKey.get(oldFieldById.get(c.source_field_id)?.field_key ?? "");
        if (!newSourceFieldId) return null;
        return {
          template_version_id: newVersionId,
          source_field_id: newSourceFieldId,
          target_section_id: c.target_section_id
            ? (sectionIdByKey.get(oldSectionById.get(c.target_section_id)?.section_key ?? "") ?? null)
            : null,
          target_field_id: c.target_field_id ? (fieldIdByKey.get(oldFieldById.get(c.target_field_id)?.field_key ?? "") ?? null) : null,
          operator: c.operator,
          comparison_value: c.comparison_value,
          action: c.action,
          logical_group: c.logical_group,
          sort_order: c.sort_order,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
    if (payload.length > 0) {
      const { error } = await supabase.from("form_conditions").insert(payload as never);
      if (error) throw new Error(error.message);
    }
  }

  // Requires the intake_document_rules INSERT policy — not yet applied as of this build.
  // Fails soft (logs, doesn't block the rest of the fork) since sections/fields/conditions
  // are the part that actually makes the organizer fillable; document rules are additive.
  const { data: docRules } = await supabase.from("intake_document_rules").select("*").eq("template_version_id", sourceVersionId);
  if (docRules && docRules.length > 0) {
    const payload = docRules.map((d) => ({
      template_version_id: newVersionId,
      source_field_key: d.source_field_key,
      operator: d.operator,
      comparison_value: d.comparison_value,
      category_slug: d.category_slug,
      document_label: d.document_label,
      description: d.description,
      is_required: d.is_required,
      minimum_files: d.minimum_files,
      maximum_files: d.maximum_files,
      priority: d.priority,
      metadata: d.metadata,
    }));
    const { error } = await supabase.from("intake_document_rules").insert(payload as never);
    if (error) console.error("[verexa-tax-office] copy intake_document_rules on customize", error);
  }
}
