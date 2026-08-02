"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { createClient } from "@/lib/supabase/server";
import { LEAD_STATUSES } from "@/lib/validation/leads";
import type { DuplicateMatch } from "@/lib/actions/clients";

type Result = { error?: string; success?: string; clientId?: string; duplicates?: DuplicateMatch[] };

async function leadGuard(permission: "leads.edit" | "leads.convert") {
  const { workspace } = await requireWorkspace();
  if (!workspace) return { error: "No workspace is selected." } as const;
  const access = await requirePermission(workspace.workspace.id, permission);
  if (!access.allowed) return { error: access.reason } as const;
  return { workspace } as const;
}

export async function setLeadStageAction(leadId: string, status: (typeof LEAD_STATUSES)[number], reason?: string): Promise<Result> {
  const auth = await leadGuard("leads.edit");
  if ("error" in auth) return { error: auth.error };
  const parsed = z.object({ leadId: z.string().uuid(), status: z.enum(LEAD_STATUSES), reason: z.string().trim().max(500).optional() }).safeParse({ leadId, status, reason });
  if (!parsed.success) return { error: "Choose a valid pipeline stage." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_lead_stage", { p_lead_id: leadId, p_status: status, p_reason: reason || undefined });
  if (error) return { error: error.message };
  revalidatePath("/leads"); revalidatePath(`/leads/${leadId}`);
  return { success: "Lead stage updated." };
}

export async function getLeadDuplicateMatchesAction(leadId: string): Promise<Result> {
  const auth = await leadGuard("leads.convert");
  if ("error" in auth) return { error: auth.error };
  if (!z.string().uuid().safeParse(leadId).success) return { error: "Invalid lead." };
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("email,phone").eq("id", leadId).eq("workspace_id", auth.workspace.workspace.id).maybeSingle();
  if (!lead) return { error: "Lead not found." };
  const { data, error } = await supabase.rpc("find_possible_duplicate_clients", { p_workspace_id: auth.workspace.workspace.id, p_email: lead.email || undefined, p_phone: lead.phone || undefined, p_identifier_fingerprint: undefined });
  if (error) return { error: "The duplicate check could not be completed." };
  return { duplicates: (data ?? []).map((row) => ({ clientId: row.client_id, displayName: row.display_name, maskedEmail: row.masked_email, maskedPhone: row.masked_phone, status: row.client_status, reasons: row.match_reasons ?? [] })) };
}

export async function convertLeadAction(input: { leadId: string; clientType: "individual" | "business"; existingClientId?: string; overrideReason?: string }): Promise<Result> {
  const auth = await leadGuard("leads.convert");
  if ("error" in auth) return { error: auth.error };
  const parsed = z.object({ leadId: z.string().uuid(), clientType: z.enum(["individual","business"]), existingClientId: z.string().uuid().optional(), overrideReason: z.string().trim().max(500).optional() }).safeParse(input);
  if (!parsed.success) return { error: "Check the conversion details." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("convert_lead_to_client_v2", {
    p_lead_id: parsed.data.leadId,
    p_client_type: parsed.data.clientType,
    p_existing_client_id: parsed.data.existingClientId,
    p_duplicate_override_reason: parsed.data.overrideReason,
  });
  if (error) return { error: error.message };
  const result = data as { client_id?: string } | null;
  if (!result?.client_id) return { error: "The lead could not be converted." };
  revalidatePath("/leads"); revalidatePath(`/leads/${parsed.data.leadId}`); revalidatePath("/clients");
  return { success: parsed.data.existingClientId ? "Lead linked to the existing client." : "Lead converted to a client.", clientId: result.client_id };
}
