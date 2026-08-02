import { notFound } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { createClient } from "@/lib/supabase/server";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { PageHeader } from "@/components/ui/PageHeader";
import { LeadFormBuilder } from "@/features/leads/lead-form-builder";

export default async function LeadFormDetailPage({params}:{params:Promise<{id:string}>}){
  const {workspace}=await requireWorkspace(); if(!workspace)return <ForbiddenState/>;
  const [manage,publish]=await Promise.all([requirePermission(workspace.workspace.id,"lead_forms.manage"),requirePermission(workspace.workspace.id,"lead_forms.publish")]); if(!manage.allowed)return <ForbiddenState description={manage.reason}/>;
  const {id}=await params; const supabase=await createClient(); const {data:form}=await supabase.from("lead_forms").select("id,name,public_slug,status,confirmation_message,consent_text,embed_settings").eq("id",id).eq("workspace_id",workspace.workspace.id).maybeSingle(); if(!form)notFound();
  return <div className="space-y-6"><PageHeader title={form.name} description="Edit the prospect experience, preview it, then intentionally publish it."/><LeadFormBuilder form={form} canPublish={publish.allowed}/></div>;
}
