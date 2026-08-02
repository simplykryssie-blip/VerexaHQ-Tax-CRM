import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getCommunicationOutbox, getReminders } from "@/features/notifications/queries";
import { CommunicationOutboxRow } from "@/features/notifications/communication-outbox-row";
import { ScheduleMessageDialog, type CommunicationClient } from "@/features/communications/schedule-message-dialog";

export default async function CommunicationsPage() {
  const context = await requireWorkspace();
  if (!context.workspace) return <ForbiddenState description="No active workspace was found." />;
  const workspaceId = context.workspace.workspace.id;
  const [view, send] = await Promise.all([requirePermission(workspaceId, "communications.view"), requirePermission(workspaceId, "communications.send")]);
  if (!view.allowed) return <ForbiddenState description={view.reason} />;
  const supabase = await createClient();
  const [{ data: clients }, outbox, reminders] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name, company, email, phone").eq("workspace_id", workspaceId).is("archived_at", null).order("last_name"),
    getCommunicationOutbox(workspaceId),
    getReminders(workspaceId, { status: "scheduled" }),
  ]);
  const options: CommunicationClient[] = (clients ?? []).map((client) => ({ id: client.id, label: client.company || `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim(), email: client.email, phone: client.phone }));
  const failed = outbox.filter((item) => item.status === "failed").length;
  const scheduled = outbox.filter((item) => item.status === "queued" && new Date(item.scheduled_for) > new Date()).length;

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3 flex-wrap"><div><h1 className="text-2xl font-semibold tracking-tight">Communications</h1><p className="text-sm text-muted-foreground mt-1">Secure messages, email, SMS, reminders, and delivery status in one place.</p></div>{send.allowed && <ScheduleMessageDialog workspaceId={workspaceId} clients={options} />}</div>
    <div className="grid gap-3 sm:grid-cols-3"><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Scheduled messages</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{scheduled}</CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Scheduled reminders</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{reminders.length}</CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm">Failed deliveries</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{failed}</CardContent></Card></div>
    <div className="flex gap-2 flex-wrap"><Button asChild size="sm" variant="secondary"><Link href="/messages">Secure inbox</Link></Button><Button asChild size="sm" variant="outline"><Link href="/communication-history">Full delivery history</Link></Button><Button asChild size="sm" variant="outline"><Link href="/notifications?tab=scheduled">Reminder schedule</Link></Button><Button asChild size="sm" variant="outline"><Link href="/calendar">Appointments</Link></Button></div>
    <div className="rounded-lg border bg-card"><div className="flex items-center justify-between border-b p-4"><div><h2 className="font-medium">Recent outbound activity</h2><p className="text-xs text-muted-foreground">Expand a row for provider events and errors.</p></div>{failed > 0 && <Badge variant="destructive">{failed} failed</Badge>}</div>{outbox.length === 0 ? <div className="p-10 text-center"><MessageSquareText className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-2 text-sm text-muted-foreground">No outbound activity yet.</p></div> : outbox.slice(0, 25).map((item) => <CommunicationOutboxRow key={item.id} item={item} />)}</div>
  </div>;
}
