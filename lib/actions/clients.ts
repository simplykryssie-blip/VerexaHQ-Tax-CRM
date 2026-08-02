"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClientSchema, type CreateClientInput } from "@/lib/validation/clients";
import { STAFF_ROLES } from "@/lib/types";
import { defaultReviewerFor, listWorkspaceStaff } from "@/lib/data/users";
import { requirePermission } from "@/lib/permissions/granular";

export type DuplicateMatch = {
  clientId: string;
  displayName: string;
  maskedEmail: string | null;
  maskedPhone: string | null;
  status: string;
  reasons: string[];
};

type ActionResult = { error?: string; clientId?: string; next?: "client" | "engagement"; duplicates?: DuplicateMatch[] };

export async function checkClientDuplicatesAction(input:{email?:string;phone?:string}):Promise<ActionResult>{
  const {workspace}=await requireWorkspace(); if(!workspace)return{error:"No workspace is selected."};
  const access=await requirePermission(workspace.workspace.id,"clients.create"); if(!access.allowed)return{error:access.reason};
  const parsed=z.object({email:z.union([z.string().trim().email(),z.literal("")]).optional(),phone:z.string().trim().max(40).optional()}).safeParse(input); if(!parsed.success)return{duplicates:[]};
  if(!parsed.data.email && (parsed.data.phone??"").replace(/\D/g,"").length<7)return{duplicates:[]};
  const supabase=await createClient(); const {data,error}=await supabase.rpc("find_possible_duplicate_clients",{p_workspace_id:workspace.workspace.id,p_email:parsed.data.email||undefined,p_phone:parsed.data.phone||undefined,p_identifier_fingerprint:undefined});
  if(error)return{error:"The duplicate check could not be completed."};
  return{duplicates:(data??[]).map(row=>({clientId:row.client_id,displayName:row.display_name,maskedEmail:row.masked_email,maskedPhone:row.masked_phone,status:row.client_status,reasons:row.match_reasons??[]}))};
}

export async function createClientAction(input: CreateClientInput): Promise<ActionResult> {
  const { workspace, user } = await requireWorkspace();
  if (!workspace || !STAFF_ROLES.includes(workspace.role)) {
    return { error: "You don't have permission to add clients in this workspace." };
  }
  const createAccess = await requirePermission(workspace.workspace.id, "clients.create");
  if (!createAccess.allowed) return { error: createAccess.reason };

  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const {
    firstName,
    lastName,
    clientType,
    setupMode,
    email,
    phone,
    company,
    notes,
    duplicateOverrideReason,
    addressLine1,
    addressLine2,
    city,
    state,
    postalCode,
    country,
    mailingSameAsPhysical,
    mailingLine1,
    mailingLine2,
    mailingCity,
    mailingState,
    mailingPostalCode,
    mailingCountry,
  } = parsed.data;
  const supabase = await createClient();
  const { data: duplicateRows, error: duplicateError } = await supabase.rpc("find_possible_duplicate_clients", {
    p_workspace_id: workspace.workspace.id,
    p_email: email || undefined,
    p_phone: phone || undefined,
    p_identifier_fingerprint: undefined,
  });
  if (duplicateError) return { error: "We couldn't complete the duplicate check." };
  const duplicates: DuplicateMatch[] = (duplicateRows ?? []).map((row) => ({
    clientId: row.client_id,
    displayName: row.display_name,
    maskedEmail: row.masked_email,
    maskedPhone: row.masked_phone,
    status: row.client_status,
    reasons: row.match_reasons ?? [],
  }));
  if (duplicates.length && !duplicateOverrideReason) return { duplicates };
  if (duplicates.length) {
    const overrideAccess = await requirePermission(workspace.workspace.id, "clients.duplicate_override");
    if (!overrideAccess.allowed) return { error: "Open the existing client file. Your role cannot override duplicate warnings." };
    if ((duplicateOverrideReason ?? "").trim().length < 8) return { error: "Explain why this is a separate client (at least 8 characters).", duplicates };
  }
  const staff = await listWorkspaceStaff(supabase, workspace.workspace.id);
  const reviewerId = defaultReviewerFor(staff, user.id, workspace.role);
  const status = "active" as const;

  const { data, error } = await supabase
    .from("clients")
    .insert({
      workspace_id: workspace.workspace.id,
      first_name: firstName || company || "Business",
      last_name: lastName || "",
      client_type: clientType,
      status,
      email: email || null,
      phone: phone || null,
      company: company || null,
      notes: notes || null,
      assigned_reviewer_user_id: reviewerId,
      ero_user_id: workspace.role === "preparer" ? reviewerId : user.id,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ? `We couldn't save this client: ${error.message}` : "We couldn't save this client. Please try again." };
  }

  if (duplicates.length) {
    await supabase.from("audit_logs").insert({
      workspace_id: workspace.workspace.id,
      actor_user_id: user.id,
      action: "client.duplicate_override",
      entity_type: "client",
      entity_id: data.id,
      new_values: { reason: duplicateOverrideReason, possible_duplicate_client_ids: duplicates.map((item) => item.clientId) },
    });
  }

  const hasPhysicalAddress = Boolean(addressLine1 || city || state || postalCode);
  if (hasPhysicalAddress) {
    await supabase.from("client_addresses").insert({
      workspace_id: workspace.workspace.id,
      client_id: data.id,
      address_type: "physical",
      is_primary: true,
      line1: addressLine1 || null,
      line2: addressLine2 || null,
      city: city || null,
      state: state || null,
      postal_code: postalCode || null,
      country: country || "US",
    });
  }
  if (hasPhysicalAddress && mailingSameAsPhysical === false) {
    const hasMailingAddress = Boolean(mailingLine1 || mailingCity || mailingState || mailingPostalCode);
    if (hasMailingAddress) {
      await supabase.from("client_addresses").insert({
        workspace_id: workspace.workspace.id,
        client_id: data.id,
        address_type: "mailing",
        is_primary: false,
        line1: mailingLine1 || null,
        line2: mailingLine2 || null,
        city: mailingCity || null,
        state: mailingState || null,
        postal_code: mailingPostalCode || null,
        country: mailingCountry || "US",
      });
    }
  }

  return {
    clientId: data.id,
    next: setupMode === "active_with_engagement" ? "engagement" : "client",
  };
}
