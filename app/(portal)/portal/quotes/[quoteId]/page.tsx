import { notFound } from "next/navigation";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PortalQuoteResponse } from "@/features/pricing/portal-quote-response";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Json } from "@/types/database";

export default async function PortalQuoteDetailPage({ params }: { params:Promise<{quoteId:string}> }) {
  const { client }=await requirePortalAccess(); if(!client)return null; const {quoteId}=await params; const supabase=await createClient();
  const {data:quote}=await supabase.from("client_quotes").select("id,quote_number,quote_type,pricing_method,amount,amount_min,amount_max,line_items,status,disclaimer,valid_until,sent_at,accepted_at,accepted_by_name").eq("id",quoteId).eq("client_id",client.client.id).neq("status","draft").maybeSingle(); if(!quote)notFound();
  const lineItems=Array.isArray(quote.line_items)?quote.line_items:[];
  return <div className="space-y-6"><PortalPageHeader title={quote.quote_number} description="Pricing proposal" actions={<StatusBadge label={quote.status} tone={quote.status==="accepted"?"success":quote.status==="declined"||quote.status==="expired"?"danger":"info"}/>}/><Card><CardHeader><h2 className="font-semibold">Service scope</h2></CardHeader><CardBody className="space-y-4">{lineItems.map((item,index)=>{const row=item&&typeof item==="object"&&!Array.isArray(item)?item as Record<string,Json|undefined>:{};return <div key={index} className="flex justify-between border-b border-border pb-3"><span>{String(row.description??"Tax services")}</span><span className="font-medium">{formatCurrency(Number(row.amount??0))}</span></div>;})}<div className="flex justify-between text-lg font-semibold"><span>Quoted price</span><span>{quote.amount!=null?formatCurrency(quote.amount):`${formatCurrency(quote.amount_min??0)}–${formatCurrency(quote.amount_max??0)}`}</span></div><p className="text-sm text-muted">{quote.disclaimer}</p><p className="text-xs text-muted">Valid through {formatDate(quote.valid_until)}</p></CardBody></Card>{["sent","viewed"].includes(quote.status)&&<PortalQuoteResponse quoteId={quote.id}/>} {quote.status==="accepted"&&<p className="rounded-xl bg-accent-50 p-4 text-sm text-accent-800">Accepted by {quote.accepted_by_name} on {formatDate(quote.accepted_at)}.</p>}</div>;
}
