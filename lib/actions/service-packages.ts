"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

type EngagementType = Database["public"]["Enums"]["engagement_type"];
type ReturnType = Database["public"]["Enums"]["tax_return_type"];
type Result = { error?: string; success?: string };

const packageSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(3).max(140),
  serviceOfferingId: z.string().optional(),
  engagementType: z.string().min(1),
  returnType: z.string().optional(),
  pricingMethod: z.enum(["fixed", "starting_at", "range", "staff_entered", "rule_based"]),
  reviewerPolicy: z.enum(["auto_ero", "required", "optional", "none"]),
  activationDefault: z.enum(["confirm_before_sending", "activate_without_sending", "activate_and_send"]),
  requirePayment: z.boolean(),
  requireSignature: z.boolean(),
  requireReviewApproval: z.boolean(),
  requireFilingAcceptance: z.boolean(),
  createInvoiceOnActivation: z.boolean(),
  inviteOnSend: z.boolean(),
});

async function authorize(key: string) {
  const { workspace, user } = await requireWorkspace();
  if (!workspace) return { error: "No workspace is selected." } as const;
  const permission = await requirePermission(workspace.workspace.id, key);
  if (!permission.allowed) return { error: permission.reason } as const;
  return { workspace, user } as const;
}

export async function saveServicePackageAction(input: z.input<typeof packageSchema>): Promise<Result> {
  const auth = await authorize(input.id ? "service_packages.edit" : "service_packages.create");
  if ("error" in auth) return { error: auth.error };
  const parsed = packageSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the package details." };

  const data = parsed.data;
  const supabase = await createClient();
  const values = {
    workspace_id: auth.workspace.workspace.id,
    name: data.name,
    service_offering_id: data.serviceOfferingId && data.serviceOfferingId !== "none" ? data.serviceOfferingId : null,
    engagement_type: data.engagementType as EngagementType,
    return_type: (data.returnType && data.returnType !== "none" ? data.returnType : null) as ReturnType | null,
    pricing_method: data.pricingMethod,
    reviewer_policy: data.reviewerPolicy,
    activation_default: data.activationDefault,
    invoice_settings: { create_on_activation: data.createInvoiceOnActivation } as Json,
    release_settings: {
      require_payment: data.requirePayment,
      require_signature: data.requireSignature,
      require_review_approval: data.requireReviewApproval,
      require_filing_acceptance: data.requireFilingAcceptance,
    } as Json,
    portal_settings: { invite_on_send: data.inviteOnSend } as Json,
  };

  const query = data.id
    ? supabase.from("engagement_type_settings").update(values).eq("id", data.id).eq("workspace_id", auth.workspace.workspace.id)
    : supabase.from("engagement_type_settings").insert({ ...values, created_by: auth.user.id });
  const { error } = await query;
  if (error) return { error: error.code === "23505" ? "A package already exists for this engagement and return type." : "The package could not be saved." };

  revalidatePath("/services");
  return { success: data.id ? "Service package updated." : "Service package created." };
}

export async function setServicePackageActiveAction(id: string, active: boolean): Promise<Result> {
  const auth = await authorize("service_packages.deactivate");
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase.from("engagement_type_settings").update({ is_active: active }).eq("id", id).eq("workspace_id", auth.workspace.workspace.id);
  if (error) return { error: "The package status could not be changed." };
  revalidatePath("/services");
  return { success: active ? "Package activated." : "Package deactivated. Existing engagements were not changed." };
}

export async function archiveServicePackageAction(id: string): Promise<Result> {
  const auth = await authorize("service_packages.deactivate");
  if ("error" in auth) return { error: auth.error };
  const supabase = await createClient();
  const { error } = await supabase
    .from("engagement_type_settings")
    .update({ archived_at: new Date().toISOString(), is_active: false })
    .eq("id", id)
    .eq("workspace_id", auth.workspace.workspace.id);
  if (error) return { error: "The package could not be archived." };
  revalidatePath("/services");
  return { success: "Package archived. Existing engagements were not changed." };
}
