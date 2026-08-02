"use client";

import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Copy, PackagePlus, Pencil, Power } from "lucide-react";
import type { Database, Json } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { saveServicePackageAction, setServicePackageActiveAction } from "@/lib/actions/service-packages";

type Setting = Database["public"]["Tables"]["engagement_type_settings"]["Row"];
export type ServicePackageSummary = Setting & {
  workflow: { name: string } | null;
  organizer: { name: string } | null;
  letter: { name: string } | null;
  checklist: { name: string } | null;
};
type EditorState = { mode: "create" | "edit" | "copy"; source: ServicePackageSummary | null } | null;

function flag(value: Json, key: string, fallback: boolean) {
  return value && typeof value === "object" && !Array.isArray(value) && typeof value[key] === "boolean" ? value[key] as boolean : fallback;
}

const engagementTypes = ["individual_return","business_return","amended_return","extension","tax_planning","bookkeeping","payroll","other"];
const returnTypes = ["1040","1040-X","1065","1120","1120-S","1041","706","709","990","941","940","state_individual","state_business","local","other"];

export function ServicePackageManager({ packages, permissions }: { packages: ServicePackageSummary[]; permissions: { create: boolean; edit: boolean; duplicate: boolean; deactivate: boolean } }) {
  const [editing, setEditing] = useState<EditorState>(null);
  const [pending, startTransition] = useTransition();
  const activeCount = useMemo(() => packages.filter((item) => item.is_active).length, [packages]);

  function run(action: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "Saved.");
    });
  }

  return <div className="space-y-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div><h1 className="text-2xl font-semibold tracking-tight">Services & Engagement Types</h1><p className="mt-1 text-sm text-muted">Reusable packages automatically apply the workflow, organizer, letter, checklist, pricing, reviewer, deadline, invoice, release, and portal defaults.</p></div>
      {permissions.create && <Button variant="brand" onClick={() => setEditing({ mode: "create", source: null })}><PackagePlus className="size-4" /> Create package</Button>}
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Packages</p><p className="mt-1 text-2xl font-semibold">{packages.length}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Active</p><p className="mt-1 text-2xl font-semibold text-accent-700">{activeCount}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Needs configuration</p><p className="mt-1 text-2xl font-semibold text-warning">{packages.filter((p) => !p.workflow || !p.organizer || !p.letter || !p.checklist).length}</p></CardContent></Card>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      {packages.map((item) => {
        const complete = Boolean(item.workflow && item.organizer && item.letter && item.checklist);
        return <Card key={item.id} className={!item.is_active ? "opacity-70" : ""}><CardContent className="p-5">
          <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{item.name}</h2><Badge variant={item.is_active ? "success" : "muted"}>{item.is_active ? "Active" : "Inactive"}</Badge></div><p className="mt-1 text-xs text-muted">{item.engagement_type.replaceAll("_", " ")} · {item.return_type ?? "Any return type"}</p></div>{complete ? <CheckCircle2 className="size-5 text-success" /> : <AlertTriangle className="size-5 text-warning" />}</div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Workflow</dt><dd>{item.workflow?.name ?? "Not configured"}</dd></div>
            <div><dt className="text-xs text-muted">Organizer</dt><dd>{item.organizer?.name ?? "Not configured"}</dd></div>
            <div><dt className="text-xs text-muted">Engagement letter</dt><dd>{item.letter?.name ?? "Not configured"}</dd></div>
            <div><dt className="text-xs text-muted">Document checklist</dt><dd>{item.checklist?.name ?? "Not configured"}</dd></div>
            <div><dt className="text-xs text-muted">Pricing</dt><dd>{item.pricing_method.replaceAll("_", " ")}</dd></div>
            <div><dt className="text-xs text-muted">Reviewer</dt><dd>{item.reviewer_policy.replaceAll("_", " ")}</dd></div>
          </dl>
          {!complete && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Missing components will create activation warnings. Configure them before using this package.</p>}
          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {permissions.edit && <Button size="sm" variant="outline" onClick={() => setEditing({ mode: "edit", source: item })}><Pencil className="size-3.5" /> Edit</Button>}
            {permissions.duplicate && permissions.create && <Button size="sm" variant="outline" disabled={pending} onClick={() => setEditing({ mode: "copy", source: item })}><Copy className="size-3.5" /> Duplicate</Button>}
            {permissions.deactivate && <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => setServicePackageActiveAction(item.id, !item.is_active))}><Power className="size-3.5" /> {item.is_active ? "Deactivate" : "Activate"}</Button>}
          </div>
        </CardContent></Card>;
      })}
    </div>

    {!packages.length && <div className="rounded-xl border border-dashed border-border bg-white p-10 text-center"><h2 className="font-semibold">No service packages</h2><p className="mt-1 text-sm text-muted">Create the first package to define how future engagements start.</p></div>}

    <PackageDialog state={editing} open={editing !== null} onClose={() => setEditing(null)} />
  </div>;
}

function PackageDialog({ state, open, onClose }: { state: EditorState; open: boolean; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const source = state?.source ?? null;
  const isEdit = state?.mode === "edit";
  const [formError, setFormError] = useState<string | null>(null);
  if (!state) return null;
  return <Dialog open={open} onOpenChange={(value) => !value && onClose()}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{isEdit ? "Edit service package" : state.mode === "copy" ? "Duplicate service package" : "Create service package"}</DialogTitle></DialogHeader>
    <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); setFormError(null); const fd = new FormData(event.currentTarget); startTransition(async () => { const result = await saveServicePackageAction({ id: isEdit ? source?.id : undefined, name: String(fd.get("name")), engagementType: String(fd.get("engagementType")), returnType: String(fd.get("returnType") ?? ""), pricingMethod: String(fd.get("pricingMethod")) as "fixed", reviewerPolicy: String(fd.get("reviewerPolicy")) as "auto_ero", activationDefault: String(fd.get("activationDefault")) as "confirm_before_sending", requirePayment: fd.get("requirePayment") === "on", requireSignature: fd.get("requireSignature") === "on", requireReviewApproval: fd.get("requireReviewApproval") === "on", requireFilingAcceptance: fd.get("requireFilingAcceptance") === "on", createInvoiceOnActivation: fd.get("createInvoiceOnActivation") === "on", inviteOnSend: fd.get("inviteOnSend") === "on" }); if (result.error) setFormError(result.error); else { toast.success(result.success ?? "Saved."); onClose(); } }); }}>
      {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">{formError}</p>}
      <div className="space-y-2"><Label htmlFor="packageName">Package name</Label><Input id="packageName" name="name" defaultValue={state.mode === "copy" ? `${source?.name ?? "Service Package"} Copy` : source?.name} required /></div>
      {state.mode === "copy" && <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">Choose a different engagement/return combination for the copy. One primary package is currently allowed for each combination.</p>}
      <div className="grid gap-4 sm:grid-cols-2"><SelectField name="engagementType" label="Engagement type" value={source?.engagement_type ?? "individual_return"} options={engagementTypes} /><SelectField name="returnType" label="Return type" value={source?.return_type ?? "none"} options={["none",...returnTypes]} /></div>
      <div className="grid gap-4 sm:grid-cols-3"><SelectField name="pricingMethod" label="Pricing method" value={source?.pricing_method ?? "staff_entered"} options={["fixed","starting_at","range","staff_entered","rule_based"]} /><SelectField name="reviewerPolicy" label="Reviewer policy" value={source?.reviewer_policy ?? "auto_ero"} options={["auto_ero","required","optional","none"]} /><SelectField name="activationDefault" label="Activation default" value={source?.activation_default ?? "confirm_before_sending"} options={["confirm_before_sending","activate_without_sending","activate_and_send"]} /></div>
      <div className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2">{[["createInvoiceOnActivation","Create invoice on activation",flag(source?.invoice_settings ?? {},"create_on_activation",false)],["inviteOnSend","Invite client when sent",flag(source?.portal_settings ?? {},"invite_on_send",true)],["requirePayment","Require payment before release",flag(source?.release_settings ?? {},"require_payment",true)],["requireSignature","Require signature before release",flag(source?.release_settings ?? {},"require_signature",true)],["requireReviewApproval","Require review approval",flag(source?.release_settings ?? {},"require_review_approval",true)],["requireFilingAcceptance","Require filing acceptance",flag(source?.release_settings ?? {},"require_filing_acceptance",false)]].map(([name,label,checked]) => <label key={String(name)} className="flex items-start gap-2 text-sm"><input type="checkbox" name={String(name)} defaultChecked={Boolean(checked)} className="mt-0.5" /><span>{String(label)}</span></label>)}</div>
      <p className="text-xs text-muted">Changes apply only to future engagements. Active and historical engagement artifacts remain frozen.</p>
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" variant="brand" disabled={pending}>{pending ? "Saving…" : "Save package"}</Button></div>
    </form>
  </DialogContent></Dialog>;
}

function SelectField({ name, label, value, options }: { name: string; label: string; value: string; options: string[] }) {
  return <div className="space-y-2"><Label>{label}</Label><Select name={name} defaultValue={value}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}>{option === "none" ? "Any / not selected" : option.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>;
}
