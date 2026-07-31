import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { roleHasCapability } from "@/lib/permissions/capabilities";
import { NewInvoiceForm } from "@/features/billing/new-invoice-form";
import type { PickerOption } from "@/features/engagements/client-picker";

export default async function NewInvoicePage() {
  const active = await getActiveWorkspace();
  if (!active) redirect("/workspaces");
  if (!roleHasCapability(active.role, "manage_billing")) redirect("/unauthorized");
  const workspaceId = active.workspace.id;
  const supabase = await createClient();

  const [{ data: clients }, { data: engagements }] = await Promise.all([
    supabase.from("clients").select("id, first_name, last_name, company").eq("workspace_id", workspaceId).is("archived_at", null),
    supabase.from("tax_engagements").select("id, engagement_number, title, client_id, tax_year").eq("workspace_id", workspaceId),
  ]);

  const clientOptions: PickerOption[] = (clients ?? []).map((c) => ({ id: c.id, label: c.company || `${c.first_name} ${c.last_name}` }));
  const engagementOptions = (engagements ?? []).map((e) => ({
    id: e.id,
    label: `${e.engagement_number ?? e.title} (${e.tax_year})`,
    clientId: e.client_id,
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New invoice</h1>
        <p className="text-sm text-muted-foreground mt-1">Line item totals, taxes, and discounts are recalculated automatically.</p>
      </div>
      <NewInvoiceForm workspaceId={workspaceId} clients={clientOptions} engagements={engagementOptions} />
    </div>
  );
}
