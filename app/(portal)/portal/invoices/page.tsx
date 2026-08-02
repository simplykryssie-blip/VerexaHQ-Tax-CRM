import { Receipt } from "lucide-react";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/formatters";

export default async function PortalInvoicesPage() {
  const { client } = await requirePortalAccess(); if (!client) return null;
  const supabase = await createClient();
  const [{ data: invoices }, { data: payments }] = await Promise.all([
    supabase.from("invoices").select("id,invoice_number,status,total,amount_paid,balance_due,issue_date,due_date,client_message").eq("client_id", client.client.id).neq("status", "draft").order("issue_date", { ascending: false }),
    supabase.from("payments").select("id,amount,status,method,paid_at,created_at,invoice_id").eq("client_id", client.client.id).order("created_at", { ascending: false }),
  ]);
  return <div className="space-y-6"><PortalPageHeader title="Invoices & Payments" description="Review balances and payment history. Online payment remains unavailable until a processor is connected." />{!invoices?.length ? <PortalEmptyState icon={Receipt} title="No invoices yet" /> : <div className="space-y-3">{invoices.map((invoice) => <Card key={invoice.id}><CardBody><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">Invoice {invoice.invoice_number}</p><p className="text-xs text-muted">Issued {formatDate(invoice.issue_date)}{invoice.due_date ? ` · Due ${formatDate(invoice.due_date)}` : ""}</p></div><StatusBadge label={invoice.status.replaceAll("_", " ")} tone={invoice.status === "paid" ? "success" : invoice.status === "past_due" ? "danger" : "info"} /></div><div className="mt-4 grid grid-cols-3 gap-3 text-sm"><div><p className="text-xs text-muted">Total</p><p className="font-medium">{formatCurrency(invoice.total)}</p></div><div><p className="text-xs text-muted">Paid</p><p className="font-medium">{formatCurrency(invoice.amount_paid)}</p></div><div><p className="text-xs text-muted">Balance</p><p className="font-semibold">{formatCurrency(invoice.balance_due ?? 0)}</p></div></div>{invoice.client_message && <p className="mt-3 text-sm">{invoice.client_message}</p>}{(payments ?? []).filter((payment) => payment.invoice_id === invoice.id).map((payment) => <p key={payment.id} className="mt-2 text-xs text-muted">Payment {formatCurrency(payment.amount)} · {payment.status} · {formatDate(payment.paid_at ?? payment.created_at)}</p>)}</CardBody></Card>)}</div>}</div>;
}
