"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { createClient } from "@/lib/supabase/server";
import { calculatePricing } from "@/lib/pricing/calculator";
import type { Json } from "@/types/database";

type Result = { error?: string; success?: string; id?: string };
const uuid = z.string().uuid();
const answersSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.array(z.string()), z.null()]));

async function authorize(permissionKey: string) {
  const { workspace, user } = await requireWorkspace();
  if (!workspace) return { error: "No workspace is selected." } as const;
  const permission = await requirePermission(workspace.workspace.id, permissionKey);
  if (!permission.allowed) return { error: permission.reason } as const;
  return { workspace, user } as const;
}

export async function savePricingConfigurationAction(input: {
  packageId: string; pricingMethod: string; basePrice?: number; minimum?: number; maximum?: number;
}): Promise<Result> {
  const auth = await authorize("pricing.rules");
  if ("error" in auth) return { error: auth.error };
  if (!uuid.safeParse(input.packageId).success) return { error: "Choose a service package." };
  const config = {
    fixed_amount: input.pricingMethod === "fixed" ? Math.max(0, Number(input.basePrice ?? 0)) : undefined,
    starting_at: ["starting_at", "rule_based"].includes(input.pricingMethod) ? Math.max(0, Number(input.basePrice ?? input.minimum ?? 0)) : undefined,
    minimum: Math.max(0, Number(input.minimum ?? input.basePrice ?? 0)),
    maximum: Math.max(0, Number(input.maximum ?? input.basePrice ?? input.minimum ?? 0)),
  } as Json;
  const supabase = await createClient();
  const { error } = await supabase.from("engagement_type_settings").update({ pricing_method: input.pricingMethod, pricing_config: config }).eq("id", input.packageId).eq("workspace_id", auth.workspace.workspace.id);
  if (error) return { error: "Pricing configuration could not be saved." };
  revalidatePath("/pricing"); revalidatePath("/services");
  return { success: "Pricing configuration saved." };
}

export async function savePricingRuleAction(input: {
  id?: string; packageId: string; name: string; description?: string; field: string; operator: string; value?: string; adjustmentType: string; amount?: number; amountMax?: number; sortOrder?: number;
}): Promise<Result> {
  const auth = await authorize("pricing.rules");
  if ("error" in auth) return { error: auth.error };
  const parsed = z.object({ id: uuid.optional(), packageId: uuid, name: z.string().trim().min(2).max(120), description: z.string().max(500).optional(), field: z.string().min(1), operator: z.string().min(1), value: z.string().optional(), adjustmentType: z.enum(["fixed_amount","per_item","percentage","minimum","maximum","price_range"]), amount: z.number().min(0).optional(), amountMax: z.number().min(0).optional(), sortOrder: z.number().int().min(0).optional() }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the pricing rule." };
  const supabase = await createClient();
  const values = { workspace_id: auth.workspace.workspace.id, engagement_type_setting_id: parsed.data.packageId, name: parsed.data.name, description: parsed.data.description || null, condition: { field: parsed.data.field, operator: parsed.data.operator, value: parsed.data.value ?? "" } as Json, adjustment_type: parsed.data.adjustmentType, amount: parsed.data.amount ?? 0, amount_max: parsed.data.adjustmentType === "price_range" ? parsed.data.amountMax ?? parsed.data.amount ?? 0 : null, sort_order: parsed.data.sortOrder ?? 0 };
  const query = parsed.data.id ? supabase.from("pricing_rules").update(values).eq("id", parsed.data.id).eq("workspace_id", auth.workspace.workspace.id) : supabase.from("pricing_rules").insert({ ...values, created_by: auth.user.id });
  const { error } = await query;
  if (error) return { error: "The pricing rule could not be saved." };
  revalidatePath("/pricing");
  return { success: parsed.data.id ? "Pricing rule updated." : "Pricing rule created." };
}

export async function setPricingRuleActiveAction(id: string, active: boolean): Promise<Result> {
  const auth = await authorize("pricing.rules");
  if ("error" in auth) return { error: auth.error };
  if (!uuid.safeParse(id).success) return { error: "Invalid pricing rule." };
  const supabase = await createClient();
  const { error } = await supabase.from("pricing_rules").update({ is_active: active }).eq("id", id).eq("workspace_id", auth.workspace.workspace.id);
  if (error) return { error: "The pricing rule status could not be changed." };
  revalidatePath("/pricing");
  return { success: active ? "Pricing rule activated." : "Pricing rule deactivated." };
}

export async function createPricingAssessmentAction(input: {
  clientId?: string; leadId?: string; engagementId?: string; packageId: string; answers: Record<string, Json>;
}): Promise<Result> {
  const auth = await authorize("pricing.assess");
  if ("error" in auth) return { error: auth.error };
  const parsed = z.object({ clientId: uuid.optional(), leadId: uuid.optional(), engagementId: uuid.optional(), packageId: uuid, answers: answersSchema }).refine((value) => Boolean(value.clientId || value.leadId), "Choose a client or lead.").safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the assessment." };
  const supabase = await createClient();
  const [{ data: pkg }, { data: template }] = await Promise.all([
    supabase.from("engagement_type_settings").select("id,pricing_config").eq("id", parsed.data.packageId).eq("workspace_id", auth.workspace.workspace.id).maybeSingle(),
    supabase.from("templates").select("id,latest_published_version_id").eq("kind", "form").contains("metadata", { system_key: "verexa_tax_pricing_assessment_v1" }).limit(1).maybeSingle(),
  ]);
  if (!pkg) return { error: "Service package not found." };
  if (!template?.latest_published_version_id) return { error: "The pricing assessment template is not published." };
  const { data: rules } = await supabase.from("pricing_rules").select("id,name,condition,adjustment_type,amount,amount_max,sort_order,is_active").eq("workspace_id", auth.workspace.workspace.id).eq("engagement_type_setting_id", pkg.id);
  const calculation = calculatePricing(parsed.data.answers, pkg.pricing_config, rules ?? []);
  const { data, error } = await supabase.from("pricing_assessments").insert({ workspace_id: auth.workspace.workspace.id, client_id: parsed.data.clientId ?? null, lead_id: parsed.data.leadId ?? null, engagement_id: parsed.data.engagementId ?? null, template_id: template.id, template_version_id: template.latest_published_version_id, status: "reviewed", answers: parsed.data.answers as Json, recommended_min: calculation.recommendedMin, recommended_max: calculation.recommendedMax, recommended_price: calculation.recommendedPrice, pricing_breakdown: calculation.breakdown as unknown as Json, submitted_at: new Date().toISOString(), reviewed_at: new Date().toISOString(), reviewed_by: auth.user.id, created_by: auth.user.id }).select("id").single();
  if (error || !data) return { error: "The pricing assessment could not be saved." };
  revalidatePath("/pricing");
  return { success: "Assessment calculated and saved.", id: data.id };
}

export async function saveQuoteAction(input: { id?: string; assessmentId?: string; clientId: string; engagementId?: string; pricingMethod: string; amount?: number; amountMin?: number; amountMax?: number; description: string; validUntil?: string; quoteType?: "initial" | "change_order"; supersedesQuoteId?: string }): Promise<Result> {
  const auth = await authorize(input.id ? "quotes.edit" : "quotes.create");
  if ("error" in auth) return { error: auth.error };
  const parsed = z.object({ id: uuid.optional(), assessmentId: uuid.optional(), clientId: uuid, engagementId: uuid.optional(), pricingMethod: z.enum(["fixed","starting_at","range","custom","rule_based"]), amount: z.number().min(0).optional(), amountMin: z.number().min(0).optional(), amountMax: z.number().min(0).optional(), description: z.string().trim().min(2).max(500), validUntil: z.string().optional(), quoteType: z.enum(["initial","change_order"]).optional(), supersedesQuoteId: uuid.optional() }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the quote." };
  const supabase = await createClient();
  if (parsed.data.id) {
    const { error } = await supabase.from("client_quotes").update({ pricing_method: parsed.data.pricingMethod, amount: parsed.data.amount ?? null, amount_min: parsed.data.amountMin ?? null, amount_max: parsed.data.amountMax ?? null, line_items: [{ description: parsed.data.description, quantity: 1, amount: parsed.data.amount ?? parsed.data.amountMin ?? 0 }] as Json, valid_until: parsed.data.validUntil || null }).eq("id", parsed.data.id).eq("workspace_id", auth.workspace.workspace.id).eq("status", "draft");
    if (error) return { error: "Only a draft quote can be edited." };
    revalidatePath("/pricing"); return { success: "Draft quote updated.", id: parsed.data.id };
  }
  const { data: quoteNumber, error: numberError } = await supabase.rpc("next_quote_number", { p_workspace_id: auth.workspace.workspace.id });
  if (numberError || !quoteNumber) return { error: "A quote number could not be generated." };
  const { data, error } = await supabase.from("client_quotes").insert({ workspace_id: auth.workspace.workspace.id, client_id: parsed.data.clientId, engagement_id: parsed.data.engagementId ?? null, pricing_assessment_id: parsed.data.assessmentId ?? null, quote_number: quoteNumber, quote_type: parsed.data.quoteType ?? "initial", pricing_method: parsed.data.pricingMethod, amount: parsed.data.amount ?? null, amount_min: parsed.data.amountMin ?? null, amount_max: parsed.data.amountMax ?? null, line_items: [{ description: parsed.data.description, quantity: 1, amount: parsed.data.amount ?? parsed.data.amountMin ?? 0 }] as Json, valid_until: parsed.data.validUntil || null, supersedes_quote_id: parsed.data.supersedesQuoteId ?? null, created_by: auth.user.id }).select("id").single();
  if (error || !data) return { error: "The quote could not be created." };
  revalidatePath("/pricing"); return { success: "Draft quote created.", id: data.id };
}

export async function sendQuoteAction(id: string): Promise<Result> {
  const auth = await authorize("quotes.send"); if ("error" in auth) return { error: auth.error };
  const supabase = await createClient(); const { error } = await supabase.rpc("send_client_quote", { p_quote_id: id });
  if (error) return { error: error.message }; revalidatePath("/pricing"); revalidatePath("/portal/quotes"); return { success: "Quote is available in the client portal." };
}

export async function expireQuoteAction(id: string): Promise<Result> {
  const auth = await authorize("quotes.send"); if ("error" in auth) return { error: auth.error };
  const supabase = await createClient(); const { error } = await supabase.rpc("expire_client_quote", { p_quote_id: id });
  if (error) return { error: error.message }; revalidatePath("/pricing"); revalidatePath("/portal/quotes"); return { success: "Quote expired." };
}

export async function respondToQuoteAction(id: string, response: "accept" | "decline", name: string): Promise<Result> {
  const { client } = await (await import("@/lib/auth/portal")).requirePortalAccess();
  if (!client) return { error: "Client portal access is required." };
  const supabase = await createClient();
  const result = response === "accept" ? await supabase.rpc("accept_client_quote", { p_quote_id: id, p_accepted_by_name: name }) : await supabase.rpc("decline_client_quote", { p_quote_id: id, p_accepted_by_name: name || undefined });
  if (result.error) return { error: result.error.message };
  revalidatePath("/portal/quotes"); revalidatePath(`/portal/quotes/${id}`); revalidatePath("/pricing");
  return { success: response === "accept" ? "Quote accepted." : "Quote declined." };
}
