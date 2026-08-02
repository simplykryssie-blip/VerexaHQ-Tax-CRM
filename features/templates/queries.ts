import { createClient } from "@/lib/supabase/server";

export async function getTemplates(workspaceId: string, opts?: { kind?: string }) {
  const supabase = await createClient();
  let query = supabase
    .from("templates")
    .select("*")
    .or(`workspace_id.eq.${workspaceId},is_system_template.eq.true`)
    .order("updated_at", { ascending: false });
  if (opts?.kind) query = query.eq("kind", opts.kind as never);
  const { data } = await query;
  return data ?? [];
}

export async function getTemplateDetail(id: string) {
  const supabase = await createClient();
  const [{ data: template }, { data: versions }] = await Promise.all([
    supabase.from("templates").select("*").eq("id", id).maybeSingle(),
    supabase.from("template_versions").select("*").eq("template_id", id).order("version_number", { ascending: false }),
  ]);
  return { template, versions: versions ?? [] };
}

export type TemplateUsage = { kind: "workflow" | "service_package"; id: string; name: string };

/** Everywhere this template is actively referenced from — surfaced so staff
 * can see "used by" before archiving, and never silently break a live
 * workflow or service package by removing a template out from under it. */
export async function getTemplateUsage(templateId: string): Promise<TemplateUsage[]> {
  const supabase = await createClient();
  const [{ data: workflows }, { data: packages }] = await Promise.all([
    supabase.from("workflow_definitions").select("id, name").eq("template_id", templateId),
    supabase
      .from("engagement_type_settings")
      .select("id, name, organizer_template_id, engagement_letter_template_id, document_checklist_template_id")
      .or(`organizer_template_id.eq.${templateId},engagement_letter_template_id.eq.${templateId},document_checklist_template_id.eq.${templateId}`),
  ]);
  return [
    ...(workflows ?? []).map((w) => ({ kind: "workflow" as const, id: w.id, name: w.name })),
    ...(packages ?? []).map((p) => ({ kind: "service_package" as const, id: p.id, name: p.name })),
  ];
}
