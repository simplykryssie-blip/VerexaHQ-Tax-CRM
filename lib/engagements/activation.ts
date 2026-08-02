import "server-only";

import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const PROFILE_FIELD_KEYS = [
  "contact_name",
  "contact_phone",
  "contact_email",
  "first_name",
  "last_name",
  "taxpayer_name",
  "email",
  "phone",
  "date_of_birth",
  "ssn_last4",
  "legal_name",
  "ein_last4",
] as const;

export async function activateAndAssignOrganizer(input: {
  supabase: SupabaseServerClient;
  workspaceId: string;
  engagementId: string;
  clientId: string;
  taxYear: number;
  returnType: string | null;
  engagementType: string;
  dueDate: string | null;
  assignedBy: string | null;
}) {
  const { supabase } = input;
  const { data: templates } = await supabase
    .from("templates")
    .select("id, current_version_id, metadata")
    .eq("kind", "form")
    .eq("status", "published")
    .or(`workspace_id.is.null,workspace_id.eq.${input.workspaceId}`);

  const template =
    templates?.find((row) => (row.metadata as Record<string, unknown>)?.tax_form === input.returnType)
    ?? templates?.find((row) => (row.metadata as Record<string, unknown>)?.engagement_type === input.engagementType);

  if (!template?.current_version_id) {
    return { error: "No published organizer matches this engagement. Save the engagement and assign an organizer manually." };
  }

  const { data: submission, error: submissionError } = await supabase
    .from("intake_submissions")
    .insert({
      workspace_id: input.workspaceId,
      client_id: input.clientId,
      engagement_id: input.engagementId,
      template_id: template.id,
      template_version_id: template.current_version_id,
      tax_year: input.taxYear,
      due_date: input.dueDate,
      assigned_by: input.assignedBy,
    })
    .select("id")
    .single();

  if (submissionError || !submission) {
    return { error: "The engagement was created, but its organizer could not be assigned." };
  }

  const [{ data: client }, { data: fields }] = await Promise.all([
    supabase
      .from("clients")
      .select("first_name, last_name, company, email, phone, date_of_birth, ssn_last4, ein_last4")
      .eq("id", input.clientId)
      .eq("workspace_id", input.workspaceId)
      .maybeSingle(),
    supabase
      .from("form_fields")
      .select("id, field_key")
      .eq("template_version_id", template.current_version_id)
      .in("field_key", [...PROFILE_FIELD_KEYS]),
  ]);

  if (client && fields?.length) {
    const values: Record<string, string | null> = {
      contact_name: [client.first_name, client.last_name].filter(Boolean).join(" "),
      contact_phone: client.phone,
      contact_email: client.email,
      first_name: client.first_name,
      last_name: client.last_name,
      taxpayer_name: [client.first_name, client.last_name].filter(Boolean).join(" "),
      email: client.email,
      phone: client.phone,
      date_of_birth: client.date_of_birth,
      ssn_last4: client.ssn_last4,
      legal_name: client.company || [client.first_name, client.last_name].filter(Boolean).join(" "),
      ein_last4: client.ein_last4,
    };
    const answers = fields
      .filter((field) => values[field.field_key])
      .map((field) => ({
        workspace_id: input.workspaceId,
        submission_id: submission.id,
        field_id: field.id,
        field_key: field.field_key,
        answer_value: values[field.field_key] as Json,
        source: "client_profile",
        rolled_forward: true,
        confirmed_by_client: false,
      }));
    if (answers.length) await supabase.from("intake_answers").insert(answers);
  }

  await Promise.all([
    supabase
      .from("tax_engagements")
      .update({ status: "awaiting_client", opened_at: new Date().toISOString() })
      .eq("id", input.engagementId)
      .eq("workspace_id", input.workspaceId),
    supabase.from("notifications").insert({
      workspace_id: input.workspaceId,
      client_id: input.clientId,
      type: "organizer_assigned",
      title: "Your tax organizer is ready",
      message: "Your tax office has assigned a tax organizer. Sign in to your portal to review your saved information and complete the service-specific sections.",
    }),
  ]);

  return { submissionId: submission.id };
}
