import Link from "next/link";
import { CheckSquare, ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { engagementStatusLabel } from "@/lib/status";
import { formatCurrency, formatDate } from "@/lib/formatters";

export default async function WorkQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const { mine } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  const workspaceId = membership!.workspace_id;

  let query = supabase
    .from("v_engagement_work_queue")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (mine === "1") {
    query = query.or(`primary_preparer_user_id.eq.${user!.id},reviewer_user_id.eq.${user!.id}`);
  }

  let taskQuery=supabase.from("tasks").select("id,title,status,priority,due_at,assigned_to_user_id,client:clients(first_name,last_name,company),engagement:tax_engagements(id,engagement_number)").eq("workspace_id",workspaceId).not("status","in",'("completed","cancelled")').order("due_at",{ascending:true,nullsFirst:false}).limit(25);
  if(mine==="1")taskQuery=taskQuery.eq("assigned_to_user_id",user!.id);
  const [{ data: items, error },{data:tasks,error:tasksError}] = await Promise.all([query,taskQuery]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Work Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">All open engagements across your workspace.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant={mine === "1" ? "ghost" : "secondary"} size="sm">
            <Link href="/work-queue">All office work</Link>
          </Button>
          <Button asChild variant={mine === "1" ? "secondary" : "ghost"} size="sm">
            <Link href="/work-queue?mine=1">My assignments</Link>
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">Couldn&apos;t load the work queue. Please refresh.</p>}

      {!items || items.length === 0 ? (
        <EmptyState icon={ListChecks} title="Nothing in the queue" description="Open engagements will show up here." />
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Engagement</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Tax year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Missing docs</TableHead>
                <TableHead>Open tasks</TableHead>
                <TableHead>Balance due</TableHead>
                <TableHead>Due date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>
                    <Link href={`/engagements/${e.id}`} className="font-medium hover:underline">
                      {e.engagement_number ?? e.title}
                    </Link>
                  </TableCell>
                  <TableCell>{e.client_name || "—"}</TableCell>
                  <TableCell>{e.tax_year}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{engagementStatusLabel(e.status ?? "")}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{e.priority}</TableCell>
                  <TableCell>
                    {Number(e.missing_document_count) > 0 ? (
                      <Badge variant="warning">{e.missing_document_count}</Badge>
                    ) : (
                      "0"
                    )}
                  </TableCell>
                  <TableCell>{e.open_task_count ?? 0}</TableCell>
                  <TableCell>{formatCurrency(e.balance_due)}</TableCell>
                  <TableCell>{formatDate(e.due_date)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="pt-3">
        <div className="mb-3 flex items-center gap-2"><CheckSquare className="size-5 text-primary"/><div><h2 className="font-semibold">Staff tasks</h2><p className="text-xs text-muted-foreground">Open assignments ordered by due date.</p></div></div>
        {tasksError&&<p className="text-sm text-destructive">Couldn&apos;t load staff tasks.</p>}
        {!tasks?.length?<EmptyState icon={CheckSquare} title="No open staff tasks" description="Assigned tasks will appear here alongside engagement work."/>:<div className="rounded-lg border border-border bg-card"><Table><TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Client</TableHead><TableHead>Priority</TableHead><TableHead>Status</TableHead><TableHead>Due</TableHead></TableRow></TableHeader><TableBody>{tasks.map(task=>{const client=task.client as {first_name:string;last_name:string;company:string|null}|null;const engagement=task.engagement as {id:string;engagement_number:string|null}|null;return <TableRow key={task.id}><TableCell><Link href={`/tasks/${task.id}`} className="font-medium hover:underline">{task.title}</Link>{engagement&&<div className="text-xs text-muted-foreground"><Link href={`/engagements/${engagement.id}`}>{engagement.engagement_number}</Link></div>}</TableCell><TableCell>{client?.company||`${client?.first_name??""} ${client?.last_name??""}`.trim()||"—"}</TableCell><TableCell><Badge variant={task.priority==="urgent"?"destructive":task.priority==="high"?"warning":"secondary"}>{task.priority}</Badge></TableCell><TableCell>{String(task.status).replaceAll("_"," ")}</TableCell><TableCell>{formatDate(task.due_at)}</TableCell></TableRow>})}</TableBody></Table></div>}
      </div>
    </div>
  );
}
