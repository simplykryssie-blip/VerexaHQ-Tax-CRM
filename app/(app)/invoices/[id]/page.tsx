import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentWorkspace } from "@/lib/auth/workspace";
import { roleHasCapability } from "@/lib/permissions/capabilities";
import { getInvoiceDetail } from "@/features/billing/queries";
import { InvoicePanel } from "@/features/billing/invoice-panel";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const active = await getCurrentWorkspace();
  if (!active) redirect("/workspaces");
  if (!roleHasCapability(active.role, "manage_billing")) redirect("/unauthorized");

  const { id } = await params;
  const { invoice, items, payments } = await getInvoiceDetail(id);
  if (!invoice) notFound();

  return (
    <div className="space-y-4">
      <Link href="/invoices" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to invoices
      </Link>
      <InvoicePanel invoice={invoice} items={items} payments={payments} />
    </div>
  );
}
