import Link from "next/link";
import { BriefcaseBusiness, ClipboardList, ListChecks, Receipt, UsersRound } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { createClient } from "@/lib/supabase/server";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { RoleDashboardHero, RoleMetric, DashboardSection, DashboardEmpty } from "@/components/dashboard/RoleDashboard";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/formatters";

type QueueRow={id:string;engagement_number:string|null;title:string;client_name:string|null;status:string|null;due_date:string|null;priority:string|null;missing_document_count:number|null;open_task_count:number|null};

export default async function DashboardPage(){
  const {user,workspace}=await requireWorkspace(); if(!workspace)return <ForbiddenState/>;
  const access=await requirePermission(workspace.workspace.id,"dashboard.view"); if(!access.allowed)return <ForbiddenState description={access.reason}/>;
  const workspaceId=workspace.workspace.id; const assigned=access.scope==="assigned"; const supabase=await createClient();
  let leads=supabase.from("leads").select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).not("status","in",'("won","lost","do_not_contact")');
  let clients=supabase.from("clients").select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).eq("status","active").is("archived_at",null);
  let engagements=supabase.from("tax_engagements").select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).is("archived_at",null).not("status","in",'("completed","cancelled")');
  let tasks=supabase.from("tasks").select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).lt("due_at",new Date().toISOString()).not("status","in",'("completed","cancelled")');
  let queue=supabase.from("v_engagement_work_queue").select("*").eq("workspace_id",workspaceId).order("due_date",{ascending:true,nullsFirst:false}).limit(8);
  if(assigned){leads=leads.eq("assigned_user_id",user.id);clients=clients.eq("assigned_user_id",user.id);engagements=engagements.or(`primary_preparer_user_id.eq.${user.id},reviewer_user_id.eq.${user.id}`);tasks=tasks.eq("assigned_to_user_id",user.id);queue=queue.or(`primary_preparer_user_id.eq.${user.id},reviewer_user_id.eq.${user.id}`);}
  const [leadResult,clientResult,engagementResult,taskResult,quoteResult,queueResult]=await Promise.all([leads,clients,engagements,tasks,supabase.from("client_quotes").select("id",{count:"exact",head:true}).eq("workspace_id",workspaceId).in("status",["sent","viewed"]),queue]);
  const items=(queueResult.data??[]) as unknown as QueueRow[];
  return <div className="space-y-6"><RoleDashboardHero eyebrow={assigned?"My assigned work":"Office command center"} title="What needs attention now" description="A live view of prospects, active clients, deadlines, open tasks, quote responses, and production pressure." actions={[{href:"/leads",label:"Open lead pipeline"},{href:"/work-queue",label:"Open staff queue"}]}/><section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><RoleMetric icon={UsersRound} label="Open leads" value={leadResult.count??0} helper="Still in the sales pipeline"/><RoleMetric icon={BriefcaseBusiness} label="Active clients" value={clientResult.count??0} helper="Current client workspaces"/><RoleMetric icon={ClipboardList} label="Open engagements" value={engagementResult.count??0} helper="Production not completed"/><RoleMetric icon={ListChecks} label="Overdue tasks" value={taskResult.count??0} helper="Past due and still open"/><RoleMetric icon={Receipt} label="Quotes awaiting reply" value={quoteResult.count??0} helper="Sent or viewed"/></section><DashboardSection title="Priority work" href="/work-queue">{items.length?<div className="divide-y divide-border">{items.map(item=><Link key={item.id} href={`/engagements/${item.id}`} className="flex flex-col gap-2 py-3.5 hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{item.client_name||item.engagement_number||item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.status?.replaceAll("_"," ")||"Engagement work"} · Due {formatDate(item.due_date)}</p></div><div className="flex gap-1.5"><Badge variant={item.priority==="urgent"?"destructive":"secondary"}>{item.priority||"normal"}</Badge>{Number(item.missing_document_count)>0&&<Badge variant="warning">{item.missing_document_count} missing docs</Badge>}{Number(item.open_task_count)>0&&<Badge variant="secondary">{item.open_task_count} tasks</Badge>}</div></Link>)}</div>:<DashboardEmpty>No active work is waiting.</DashboardEmpty>}</DashboardSection></div>;
}
