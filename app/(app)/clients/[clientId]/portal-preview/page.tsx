import Link from "next/link";
import { notFound } from "next/navigation";
import { Eye, FileText, FolderOpen, MessageSquare, Receipt, ShieldCheck } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { createClient } from "@/lib/supabase/server";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function PortalPreviewPage({ params }: { params: Promise<{ clientId: string }> }) {
  const context = await requireWorkspace();
  if (!context.workspace) return <ForbiddenState description="No active workspace was found." />;
  const workspaceId = context.workspace.workspace.id;
  const access = await requirePermission(workspaceId, "portal.preview");
  if (!access.allowed) return <ForbiddenState description={access.reason} />;
  const { clientId } = await params;
  const supabase = await createClient();
  const [{ data: client }, engagements, intakes, documents, conversations, invoices] = await Promise.all([
    supabase.from("clients").select("id,first_name,last_name,company,email").eq("workspace_id", workspaceId).eq("id", clientId).maybeSingle(),
    supabase.from("tax_engagements").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("client_id", clientId),
    supabase.from("intake_submissions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("client_id", clientId),
    supabase.from("documents").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("client_id", clientId).is("deleted_at", null),
    supabase.from("conversations").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("client_id", clientId),
    supabase.from("invoices").select("balance_due").eq("workspace_id", workspaceId).eq("client_id", clientId).neq("status", "void"),
  ]);
  if (!client) notFound();
  await supabase.from("audit_logs").insert({ workspace_id: workspaceId, actor_user_id: context.user.id, entity_type: "client", entity_id: clientId, action: "portal_preview_viewed", new_values: { mode: "read_only" } });
  const name = client.company || `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim();
  const balance = (invoices.data ?? []).reduce((sum, row) => sum + Number(row.balance_due ?? 0), 0);
  const cards = [{ label: "Engagements", value: engagements.count ?? 0, icon: ShieldCheck }, { label: "Organizers", value: intakes.count ?? 0, icon: FileText }, { label: "Documents", value: documents.count ?? 0, icon: FolderOpen }, { label: "Messages", value: conversations.count ?? 0, icon: MessageSquare }, { label: "Balance due", value: `$${balance.toFixed(2)}`, icon: Receipt }];
  return <div className="space-y-5"><div className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 p-3 text-sm"><p className="flex items-center gap-2 font-semibold"><Eye className="h-4 w-4" />Read-only client preview</p><p className="mt-1 text-muted-foreground">You are seeing the client-facing summary for {name}. Actions, uploads, signatures, payments, and messages are disabled. This preview was recorded in the audit log.</p></div><div className="flex items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Welcome, {name}</h1><p className="text-sm text-muted-foreground">{client.email}</p></div><Button asChild variant="outline"><Link href={`/clients/${clientId}`}>Back to client workspace</Link></Button></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{cards.map((item) => <Card key={item.label}><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm"><item.icon className="h-4 w-4" />{item.label}</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{item.value}</CardContent></Card>)}</div><Card><CardHeader><CardTitle>What the client can do</CardTitle></CardHeader><CardContent className="grid gap-2 text-sm sm:grid-cols-2"><p>Complete assigned organizers</p><p>Upload requested documents</p><p>Respond to quotes and messages</p><p>View appointments and notifications</p><p>Track signatures and invoices</p><p>Download returns after release</p></CardContent></Card></div>;
}
