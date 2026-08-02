"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

type Result = { error?: string; success?: string; submissionId?: string };
const allowedFields = ["first_name","last_name","email","phone","company","services","preferred_contact_method","description"] as const;

export async function saveLeadFormAction(input: { id: string; name: string; slug: string; heading: string; description?: string; confirmationMessage: string; consentText: string; accentColor: string; fields: string[] }): Promise<Result> {
  const { workspace } = await requireWorkspace();
  if (!workspace) return { error: "No workspace is selected." };
  const access = await requirePermission(workspace.workspace.id,"lead_forms.manage");
  if (!access.allowed) return { error: access.reason };
  const parsed = z.object({ id:z.string().uuid(),name:z.string().trim().min(2).max(120),slug:z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),heading:z.string().trim().min(2).max(160),description:z.string().trim().max(500).optional(),confirmationMessage:z.string().trim().min(2).max(500),consentText:z.string().trim().min(2).max(1000),accentColor:z.string().regex(/^#[0-9a-fA-F]{6}$/),fields:z.array(z.enum(allowedFields)).min(3) }).safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form settings." };
  if (!parsed.data.fields.includes("email") && !parsed.data.fields.includes("phone")) return { error: "Public forms must request email or phone." };
  const supabase = await createClient();
  const { error } = await supabase.from("lead_forms").update({ name:parsed.data.name,public_slug:parsed.data.slug,confirmation_message:parsed.data.confirmationMessage,consent_text:parsed.data.consentText,embed_settings:{ heading:parsed.data.heading,description:parsed.data.description || "",accent_color:parsed.data.accentColor,fields:parsed.data.fields } as Json }).eq("id",parsed.data.id).eq("workspace_id",workspace.workspace.id);
  if (error) return { error: error.code === "23505" ? "That public URL is already in use." : "The lead form could not be saved." };
  revalidatePath("/lead-forms"); revalidatePath(`/lead-forms/${parsed.data.id}`); revalidatePath(`/forms/${parsed.data.slug}`);
  return { success:"Lead form saved." };
}

export async function setLeadFormStatusAction(id: string,status: "draft"|"published"|"paused"|"archived"): Promise<Result> {
  const { workspace } = await requireWorkspace(); if (!workspace) return { error:"No workspace is selected." };
  const access = await requirePermission(workspace.workspace.id,"lead_forms.publish"); if (!access.allowed) return { error:access.reason };
  const supabase = await createClient(); const { error } = await supabase.rpc("set_lead_form_status",{p_form_id:id,p_status:status});
  if (error) return { error:error.message };
  revalidatePath("/lead-forms"); revalidatePath(`/lead-forms/${id}`);
  return { success:`Lead form ${status}.` };
}

export async function submitPublicLeadFormAction(slug:string,formData:FormData):Promise<Result>{
  const payload:Record<string,Json>={};
  for(const key of allowedFields){
    const values=formData.getAll(key).map(String).map((value)=>value.trim()).filter(Boolean);
    if(values.length) payload[key]=key==="services"?values:values[0];
  }
  const consent=formData.get("consent")==="on"; const honeypot=String(formData.get("website")??"");
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("submit_public_lead_form",{p_public_slug:slug,p_payload:payload,p_consent_given:consent,p_honeypot:honeypot||undefined});
  if(error)return{error:error.message};
  const row=data?.[0]; return{success:row?.confirmation_message??"Thank you. Your request was received.",submissionId:row?.submission_id};
}
