import Link from "next/link";
import { ArrowRight, BadgeDollarSign } from "lucide-react";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/formatters";

export default async function PortalQuotesPage() {
  const { client } = await requirePortalAccess(); if (!client) return null;
  const supabase = await createClient();
  const { data: quotes } = await supabase.from("client_quotes").select("id,quote_number,quote_type,pricing_method,amount,amount_min,amount_max,status,valid_until,created_at").eq("client_id",client.client.id).neq("status","draft").order("created_at",{ascending:false});
  return <div className="space-y-6"><PortalPageHeader title="Quotes" description="Review and respond to pricing from your tax office."/>{!quotes?.length?<PortalEmptyState icon={BadgeDollarSign} title="No quotes yet"/>:<div className="space-y-3">{quotes.map(quote=><Link key={quote.id} href={`/portal/quotes/${quote.id}`}><Card className="transition-shadow hover:shadow-md"><CardBody className="flex items-center justify-between gap-3"><div><p className="font-semibold">{quote.quote_number}</p><p className="text-xs text-muted">Valid through {formatDate(quote.valid_until)}</p></div><div className="flex items-center gap-3"><div className="text-right"><p className="font-semibold">{quote.amount!=null?formatCurrency(quote.amount):`${formatCurrency(quote.amount_min??0)}–${formatCurrency(quote.amount_max??0)}`}</p><StatusBadge label={quote.status} tone={quote.status==="accepted"?"success":quote.status==="declined"||quote.status==="expired"?"danger":"info"}/></div><ArrowRight className="size-4 text-muted"/></div></CardBody></Card></Link>)}</div>}</div>;
}
