import Link from "next/link";
import { CreditCard, FileText, Plus, Receipt, WalletCards } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { getInvoices, getOutstandingBalance, getPayments } from "@/features/billing/queries";
import { PageHeader } from "@/components/ui/PageHeader";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";
import { Card, CardBody, CardHeader } from "@/components/ui/LegacyCard";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";

export default async function BillingPage() {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;
  const access = await requirePermission(workspace.workspace.id, "billing.manage");
  if (!access.allowed) return <ForbiddenState description={access.reason} />;

  const [invoices, payments, outstanding] = await Promise.all([
    getInvoices(workspace.workspace.id),
    getPayments(workspace.workspace.id),
    getOutstandingBalance(workspace.workspace.id),
  ]);
  const paid = payments.filter((payment) => payment.status === "succeeded").reduce((total, payment) => total + Number(payment.amount || 0), 0);
  const openInvoices = invoices.filter((invoice) => !["paid", "void", "draft"].includes(invoice.status)).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing"
        description="Track quotes, invoices, balances, payments, voids, and refunds from one staff workspace."
        actions={<Button asChild size="sm" variant="brand"><Link href="/invoices/new"><Plus className="size-4" /> New invoice</Link></Button>}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardBody><p className="text-xs text-muted">Outstanding</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(outstanding)}</p></CardBody></Card>
        <Card><CardBody><p className="text-xs text-muted">Payments recorded</p><p className="mt-1 text-2xl font-semibold">{formatCurrency(paid)}</p></CardBody></Card>
        <Card><CardBody><p className="text-xs text-muted">Open invoices</p><p className="mt-1 text-2xl font-semibold">{openInvoices}</p></CardBody></Card>
        <Card><CardBody><p className="text-xs text-muted">Draft quotes</p><p className="mt-1 text-2xl font-semibold">—</p><Link href="/pricing" className="text-xs font-medium text-accent-700">Open pricing & quotes</Link></CardBody></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { href: "/invoices", label: "Invoices", detail: "Create, send, void, and review balances.", icon: Receipt },
          { href: "/payments", label: "Payments", detail: "Track payment status, methods, refunds, and failures.", icon: CreditCard },
          { href: "/pricing", label: "Pricing & quotes", detail: "Run assessments, set flat fees, and create client quotes.", icon: WalletCards },
        ].map((item) => <Card key={item.href}><CardBody><item.icon className="size-5 text-accent-700" /><p className="mt-3 font-semibold">{item.label}</p><p className="mt-1 text-sm text-muted">{item.detail}</p><Link href={item.href} className="mt-3 inline-flex text-sm font-medium text-accent-700 hover:underline">Open</Link></CardBody></Card>)}
      </div>

      <Card>
        <CardHeader><h2 className="text-sm font-semibold">Recent invoices</h2></CardHeader>
        <CardBody className="space-y-2">
          {invoices.slice(0, 5).map((invoice) => <Link key={invoice.id} href={`/invoices/${invoice.id}`} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-slate-50"><span className="flex items-center gap-2"><FileText className="size-4 text-muted" />{invoice.invoice_number}</span><span>{formatCurrency(invoice.balance_due)} due · {formatDate(invoice.due_date)}</span></Link>)}
          {invoices.length === 0 && <p className="text-sm text-muted">No invoices yet.</p>}
        </CardBody>
      </Card>
    </div>
  );
}
