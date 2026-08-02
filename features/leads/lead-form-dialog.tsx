"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SearchablePicker, type PickerOption } from "@/features/engagements/client-picker";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import { leadSchema, LEAD_STATUSES, LEAD_STATUS_LABELS, OTHER_SOURCE_VALUE, type LeadInput } from "@/lib/validation/leads";
import { toast } from "@/components/ui/toaster";
import type { Tables } from "@/types/database";
import type { CatalogOption } from "@/features/leads/queries";
import { Loader2, Plus } from "lucide-react";

type Lead = Tables<"leads">;
type FollowUpTask = Tables<"tasks">;

export function LeadFormDialog({
  workspaceId,
  lead,
  leadSources,
  serviceOfferings,
  staff,
  initialServiceOfferingIds,
  followUpTask,
  trigger,
}: {
  workspaceId: string;
  lead?: Lead;
  leadSources: CatalogOption[];
  serviceOfferings: CatalogOption[];
  staff: PickerOption[];
  initialServiceOfferingIds?: string[];
  followUpTask?: FollowUpTask | null;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceOfferingIds, setServiceOfferingIds] = useState<string[]>(initialServiceOfferingIds ?? []);
  const [followUpAssignee, setFollowUpAssignee] = useState<string | null>(followUpTask?.assigned_to_user_id ?? null);

  // Sources are workspace-configurable; if the lead's current value isn't in
  // the active list (legacy or since-deactivated source), keep it selectable
  // so existing data is never silently hidden.
  const knownSourceValues = new Set(leadSources.map((s) => s.value));
  const legacySource = lead?.source && lead.source !== OTHER_SOURCE_VALUE && !knownSourceValues.has(lead.source) ? lead.source : null;
  const initialSource = legacySource ?? (lead?.source && knownSourceValues.has(lead.source) ? lead.source : lead?.source ? OTHER_SOURCE_VALUE : "");
  const initialSourceOther = legacySource ? "" : lead?.source && !knownSourceValues.has(lead.source) ? lead.source : "";

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      firstName: lead?.first_name ?? "",
      lastName: lead?.last_name ?? "",
      email: lead?.email ?? "",
      phone: lead?.phone ?? "",
      company: lead?.company ?? "",
      source: initialSource,
      sourceOther: initialSourceOther,
      status: lead?.status ?? "new",
      notes: lead?.notes ?? "",
      consultationAt: lead?.consultation_at ? lead.consultation_at.slice(0, 16) : "",
      nextFollowUpDueAt: followUpTask?.due_at ? followUpTask.due_at.slice(0, 16) : "",
      nextFollowUpAssignedTo: followUpTask?.assigned_to_user_id ?? null,
      nextFollowUpNotes: followUpTask?.description ?? "",
    },
  });

  async function onSubmit(values: LeadInput) {
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const resolvedSource = values.source === OTHER_SOURCE_VALUE ? values.sourceOther?.trim() || null : values.source || null;
    const serviceInterestSummary = serviceOfferings
      .filter((o) => serviceOfferingIds.includes(o.value))
      .map((o) => o.label)
      .join(", ");

    const payload = {
      workspace_id: workspaceId,
      first_name: values.firstName,
      last_name: values.lastName,
      email: values.email || null,
      phone: values.phone || null,
      company: values.company || null,
      source: resolvedSource,
      service_interest: serviceInterestSummary || null,
      status: values.status,
      notes: values.notes || null,
      consultation_at: values.consultationAt ? new Date(values.consultationAt).toISOString() : null,
    };

    const { data: savedLead, error: dbError } = lead
      ? await supabase.from("leads").update(payload).eq("id", lead.id).select("id").single()
      : await supabase.from("leads").insert(payload).select("id").single();

    if (dbError || !savedLead) {
      setSubmitting(false);
      setError(friendlyDbError(dbError?.message ?? "unknown"));
      return;
    }

    const leadId = savedLead.id;

    // Reconcile the multi-select service interests (small sets — replace is
    // simpler and safer than diffing, and RLS scopes it to this lead).
    await supabase.from("lead_service_interests").delete().eq("lead_id", leadId);
    if (serviceOfferingIds.length > 0) {
      await supabase.from("lead_service_interests").insert(
        serviceOfferingIds.map((serviceOfferingId) => ({ lead_id: leadId, service_offering_id: serviceOfferingId })),
      );
    }

    // Next Follow-up is a lightweight task, reusing the existing tasks
    // table/feature rather than a new one. Only touched if the staff member
    // entered something — an existing task is never silently cancelled.
    const hasFollowUpInput = values.nextFollowUpDueAt || values.nextFollowUpNotes || followUpAssignee;
    if (hasFollowUpInput) {
      const taskPayload = {
        workspace_id: workspaceId,
        lead_id: leadId,
        task_type: "lead_follow_up",
        title: `Follow up with ${values.firstName} ${values.lastName}`.trim(),
        description: values.nextFollowUpNotes || null,
        due_at: values.nextFollowUpDueAt ? new Date(values.nextFollowUpDueAt).toISOString() : null,
        assigned_to_user_id: followUpAssignee,
        assigned_by_user_id: user?.id ?? null,
        created_by: user?.id ?? null,
      };
      if (followUpTask) {
        await supabase.from("tasks").update(taskPayload).eq("id", followUpTask.id);
      } else {
        await supabase.from("tasks").insert(taskPayload);
      }
    }

    setSubmitting(false);
    toast.success(lead ? "Lead updated" : "Lead added");
    setOpen(false);
    reset();
    router.refresh();
  }

  const status = watch("status");
  const source = watch("source");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="brand">
            <Plus className="h-4 w-4" /> Add lead
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{lead ? "Edit lead" : "Add lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>First name</Label>
              <Input {...register("firstName")} aria-invalid={!!errors.firstName} />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Last name</Label>
              <Input {...register("lastName")} aria-invalid={!!errors.lastName} />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-1">
              <Label>Phone</Label>
              <Input type="tel" {...register("phone")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Company</Label>
              <Input {...register("company")} />
            </div>
            <div className="space-y-1">
              <Label>Source</Label>
              <Select value={source || ""} onValueChange={(v) => setValue("source", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a source…" />
                </SelectTrigger>
                <SelectContent>
                  {legacySource && <SelectItem value={legacySource}>{legacySource} (no longer active)</SelectItem>}
                  {leadSources.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {source === OTHER_SOURCE_VALUE && (
            <div className="space-y-1">
              <Label>Custom source</Label>
              <Input {...register("sourceOther")} placeholder="Describe the source" />
              {errors.sourceOther && <p className="text-xs text-destructive">{errors.sourceOther.message}</p>}
            </div>
          )}
          <div className="space-y-1">
            <Label>Services of interest</Label>
            <MultiSelect
              options={serviceOfferings}
              selected={serviceOfferingIds}
              onChange={setServiceOfferingIds}
              placeholder="Select services…"
              searchPlaceholder="Search services…"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setValue("status", v as LeadInput["status"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAD_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {LEAD_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Consultation appointment</Label>
              <Input type="datetime-local" {...register("consultationAt")} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next follow-up</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Due date</Label>
                <Input type="datetime-local" {...register("nextFollowUpDueAt")} />
              </div>
              <div className="space-y-1">
                <Label>Assign to</Label>
                <SearchablePicker options={staff} value={followUpAssignee} onChange={setFollowUpAssignee} placeholder="Staff member…" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Follow-up notes</Label>
              <Textarea rows={2} {...register("nextFollowUpNotes")} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea rows={3} {...register("notes")} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="brand" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {lead ? "Save changes" : "Add lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
