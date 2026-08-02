import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { PageHeader } from "@/components/ui/PageHeader";
import { StaffQuoteActions } from "@/features/pricing/quote-actions";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Json } from "@/types/database";

export default async function QuoteDetailPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { workspace } = await requireWorkspace(); if (!workspace) return <ForbiddenState />;
  const access = await requirePermission(workspace.workspace.id,"quotes.view"); if (!access.allowed) return <ForbiddenState description={access.reason}/>;
  const { quoteId } = await params; const supabase = await createClient();
  const { data: quote } = await supabase.from("client_quotes").select("*,client:clients(first_name,last_name,company,email),assessment:pricing_assessments(answers,pricing_breakdown,recommended_price,recommended_min,recommended_max)").eq("id",quoteId).eq("workspace_id",workspace.workspace.id).maybeSingle();
  if (!quote) notFound(); const [send,changeOrder] = await Promise.all([requirePermission(workspace.workspace.id,"quotes.send"),requirePermission(workspace.workspace.id,"quotes.change_order")]);
  const client = quote.client as { first_name:string|null;last_name:string|null;company:string|null;email:string|null } | null;
  const lineItems = Array.isArray(quote.line_items) ? quote.line_items : [];
  return <div className="space-y-6"><PageHeader title={quote.quote_number} description={client?.company || `${client?.first_name??""} ${client?.last_name??""}`.trim()} actions={<StaffQuoteActions id={quote.id} status={quote.status} canSend={send.allowed} canChangeOrder={changeOrder.allowed}/>}/><div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle>Scope & pricing</CardTitle></CardHeader><CardContent className="space-y-4">{lineItems.map((item,index)=>{const row=item && typeof item==="object"&&!Array.isArray(item)?item as Record<string,Json|undefined>:{};return <div key={index} className="flex justify-between border-b border-border pb-3"><span>{String(row.description??"Service")}</span><span className="font-medium">{formatCurrency(Number(row.amount??0))}</span></div>;})}<p className="text-lg font-semibold">{quote.amount!=null?formatCurrency(quote.amount):`${formatCurrency(quote.amount_min??0)}–${formatCurrency(quote.amount_max??0)}`}</p><p className="text-sm text-muted">{quote.disclaimer}</p></CardContent></Card><Card><CardHeader><CardTitle>Status</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted">Status</span><Badge variant={quote.status==="accepted"?"success":"secondary"}>{quote.status}</Badge></div><div className="flex justify-between"><span className="text-muted">Valid until</span><span>{formatDate(quote.valid_until)}</span></div><div className="flex justify-between"><span className="text-muted">Sent</span><span>{formatDate(quote.sent_at)}</span></div><div className="flex justify-between"><span className="text-muted">Accepted</span><span>{formatDate(quote.accepted_at)}</span></div>{quote.accepted_by_name&&<div><p className="text-muted">Accepted by</p><p className="font-medium">{quote.accepted_by_name}</p></div>}</CardContent></Card></div></div>;
}
