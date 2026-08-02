import Link from "next/link";
import { ExternalLink, FileInput } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { createClient } from "@/lib/supabase/server";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";

export default async function LeadFormsPage(){
  const {workspace}=await requireWorkspace(); if(!workspace)return <ForbiddenState/>;
  const access=await requirePermission(workspace.workspace.id,"lead_forms.manage"); if(!access.allowed)return <ForbiddenState description={access.reason}/>;
  const supabase=await createClient(); const {data:forms}=await supabase.from("lead_forms").select("id,name,public_slug,status,updated_at").eq("workspace_id",workspace.workspace.id).neq("status","archived").order("updated_at",{ascending:false});
  return <div className="space-y-6"><PageHeader title="Public Lead Forms" description="Build, publish, and share secure prospect forms that feed your lead pipeline."/>{!forms?.length?<EmptyState icon={FileInput} title="No lead form is configured" description="The Verexa default lead form is installed when a workspace is created."/>:<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{forms.map(form=><Card key={form.id}><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{form.name}</h2><p className="mt-1 text-xs text-muted-foreground">/forms/{form.public_slug}</p></div><Badge variant={form.status==="published"?"success":"secondary"}>{form.status}</Badge></div><div className="mt-5 flex items-center justify-between"><Link className="text-sm font-semibold text-primary hover:underline" href={`/lead-forms/${form.id}`}>Edit & preview</Link>{form.status==="published"&&<Link href={`/forms/${form.public_slug}`} target="_blank" className="text-muted-foreground hover:text-foreground"><ExternalLink className="size-4"/></Link>}</div></CardContent></Card>)}</div>}</div>;
}
