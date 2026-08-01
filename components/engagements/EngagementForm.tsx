"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  createEngagementSchema,
  engagementTypeOptions,
  returnTypeOptions,
  engagementPriorityOptions,
  type CreateEngagementInput,
} from "@/lib/validation/engagements";
import { createEngagementAction } from "@/lib/actions/engagements";
import { engagementTypeLabels, returnTypeLabels, engagementPriorityMeta } from "@/lib/status";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/LegacyButton";
import { JurisdictionPicker } from "@/components/engagements/JurisdictionPicker";
import { clientDisplayName } from "@/lib/utils";
import type { Client } from "@/lib/types";
import type { UserSummary } from "@/lib/data/users";
import { calculateEngagementDeadlines, type JurisdictionCode } from "@/lib/tax/deadlines";
import { useRouter } from "next/navigation";

type ClientOption = Pick<Client, "id" | "first_name" | "last_name" | "display_name" | "preferred_name" | "company">;
type EngagementFormInput = z.input<typeof createEngagementSchema>;
const currentYear = new Date().getFullYear();

export function EngagementForm({
  clients,
  staff,
  initialClientId,
  defaultReviewerId,
  reviewerLocked,
}: {
  clients: ClientOption[];
  staff: UserSummary[];
  initialClientId?: string;
  defaultReviewerId: string | null;
  reviewerLocked: boolean;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EngagementFormInput, unknown, CreateEngagementInput>({
    resolver: zodResolver(createEngagementSchema),
    defaultValues: {
      clientId: initialClientId ?? "",
      status: "draft",
      priority: "normal",
      taxYear: currentYear,
      engagementType: "individual",
      returnType: "1040",
      reviewerUserId: defaultReviewerId ?? "",
      federalReturnRequired: true,
      stateReturnRequired: false,
      localReturnRequired: false,
      jurisdictions: [],
      extensionFiled: false,
      activationMode: "save_draft",
    },
  });

  const [watchedTaxYear, watchedReturnType, watchedFiscalYearEnd, watchedFederalRequired, watchedJurisdictions] = useWatch({
    control,
    name: ["taxYear", "returnType", "fiscalYearEnd", "federalReturnRequired", "jurisdictions"],
  });
  const schedule = calculateEngagementDeadlines({
    taxYear: Number(watchedTaxYear || currentYear),
    returnType: watchedReturnType || null,
    fiscalYearEnd: watchedFiscalYearEnd || null,
    federalRequired: watchedFederalRequired ?? true,
    jurisdictions: (watchedJurisdictions ?? []) as JurisdictionCode[],
  });

  const onSubmit = async (data: CreateEngagementInput) => {
    setFormError(null);
    const result = await createEngagementAction({
      ...data,
      stateReturnRequired: data.jurisdictions.length > 0,
    });
    if (result?.error) {
      setFormError(result.error);
      return;
    }
    if (!result?.engagementId) return;

    if (result.sendPortalInvite && result.clientId) {
      const response = await fetch("/api/portal/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: result.clientId }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        window.alert(body?.error ?? "The engagement and organizer were created, but the portal invitation could not be sent.");
      }
    }
    if (result.warning) window.alert(result.warning);
    router.push(`/engagements/${result.engagementId}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-7">
      {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

      <section className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-foreground">1. Client and service</h2>
          <p className="mt-1 text-sm text-muted">The client is permanent. This engagement is the specific job your office is performing.</p>
        </div>
        <FormField label="Client" htmlFor="clientId" error={errors.clientId?.message} required>
          <select id="clientId" className={inputClassName} {...register("clientId")}>
            <option value="" disabled>Select a client…</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{clientDisplayName(client)}</option>)}
          </select>
        </FormField>
        <FormField label="Engagement title" htmlFor="title" error={errors.title?.message} required>
          <input id="title" className={inputClassName} placeholder="e.g. 2026 Individual Form 1040" {...register("title")} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Tax year" htmlFor="taxYear" error={errors.taxYear?.message} required>
            <input id="taxYear" type="number" className={inputClassName} {...register("taxYear")} />
          </FormField>
          <FormField label="Engagement type" htmlFor="engagementType" error={errors.engagementType?.message} required>
            <select id="engagementType" className={inputClassName} {...register("engagementType")}>
              {engagementTypeOptions.map((type) => <option key={type} value={type}>{engagementTypeLabels[type]}</option>)}
            </select>
          </FormField>
          <FormField label="Return type" htmlFor="returnType" error={errors.returnType?.message}>
            <select id="returnType" className={inputClassName} {...register("returnType")}>
              <option value="">Not selected</option>
              {returnTypeOptions.map((type) => <option key={type} value={type}>{returnTypeLabels[type]}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Fiscal-year end" htmlFor="fiscalYearEnd" error={errors.fiscalYearEnd?.message} hint="Leave blank for a calendar-year return.">
          <input id="fiscalYearEnd" type="date" className={inputClassName} {...register("fiscalYearEnd")} />
        </FormField>
      </section>

      <section className="space-y-5 border-t border-border pt-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">2. Assignment</h2>
          <p className="mt-1 text-sm text-muted">Connected PTIN preparers automatically use their ERO as reviewer. EROs can reassign review work.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="Priority" htmlFor="priority" error={errors.priority?.message}>
            <select id="priority" className={inputClassName} {...register("priority")}>
              {engagementPriorityOptions.map((priority) => <option key={priority} value={priority}>{engagementPriorityMeta(priority).label}</option>)}
            </select>
          </FormField>
          <FormField label="Preparer" htmlFor="preparerUserId" error={errors.preparerUserId?.message} hint="Optional at creation.">
            <select id="preparerUserId" className={inputClassName} {...register("preparerUserId")}>
              <option value="">Unassigned</option>
              {staff.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
            </select>
          </FormField>
          <FormField label="Reviewer" htmlFor="reviewerUserId" error={errors.reviewerUserId?.message} hint={reviewerLocked ? "Controlled by the connected ERO." : "Defaults to you; may be reassigned."}>
            <select id="reviewerUserId" className={inputClassName} disabled={reviewerLocked} {...register("reviewerUserId")}>
              <option value="">Unassigned</option>
              {staff.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}
            </select>
          </FormField>
        </div>
      </section>

      <section className="space-y-5 border-t border-border pt-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">3. Jurisdictions and statutory deadlines</h2>
          <p className="mt-1 text-sm text-muted">Verexa calculates supported statutory filing, payment, and extension dates. It flags forms that require office review instead of guessing.</p>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
          <input type="checkbox" {...register("federalReturnRequired")} /> Federal return required
        </label>
        <Controller
          name="jurisdictions"
          control={control}
          render={({ field }) => <JurisdictionPicker value={field.value ?? []} onChange={field.onChange} />}
        />
        <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
          <input type="checkbox" {...register("localReturnRequired")} /> Local return required
        </label>
        <div className="rounded-xl border border-accent-200 bg-accent-50 p-4">
          <p className="text-sm font-semibold text-foreground">Calculated deadline preview</p>
          <div className="mt-3 space-y-3">
            {schedule.items.map((item) => (
              <div key={`${item.authority}-${item.jurisdiction}`} className="grid gap-1 text-sm sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
                <span className="font-medium text-foreground">{item.jurisdiction}</span>
                <span>File: {item.filingDate ?? "Review required"}</span>
                <span>Pay: {item.paymentDate ?? "Review required"}</span>
                <span>Extended: {item.extensionDate ?? "—"}</span>
              </div>
            ))}
            {!schedule.items.length && <p className="text-sm text-muted">Choose a return type or jurisdiction to calculate deadlines.</p>}
          </div>
          <p className="mt-3 text-xs font-medium text-warning">An extension to file does not extend the payment deadline.</p>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
          <input type="checkbox" {...register("extensionFiled")} /> Extension filed or accepted
        </label>
      </section>

      <section className="space-y-5 border-t border-border pt-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">4. Staff-controlled deadlines</h2>
          <p className="mt-1 text-sm text-muted">These are office targets and client expectations—not statutory filing dates.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Client document deadline" htmlFor="clientDocumentDueDate"><input id="clientDocumentDueDate" type="date" className={inputClassName} {...register("clientDocumentDueDate")} /></FormField>
          <FormField label="Internal preparation target" htmlFor="internalDueDate"><input id="internalDueDate" type="date" className={inputClassName} {...register("internalDueDate")} /></FormField>
          <FormField label="Reviewer deadline" htmlFor="reviewerDueDate"><input id="reviewerDueDate" type="date" className={inputClassName} {...register("reviewerDueDate")} /></FormField>
          <FormField label="Signature deadline" htmlFor="signatureDueDate"><input id="signatureDueDate" type="date" className={inputClassName} {...register("signatureDueDate")} /></FormField>
          <FormField label="Custom deadline label" htmlFor="customDeadlineLabel"><input id="customDeadlineLabel" className={inputClassName} placeholder="e.g. Bookkeeping cleanup complete" {...register("customDeadlineLabel")} /></FormField>
          <FormField label="Custom deadline date" htmlFor="customDeadlineDate"><input id="customDeadlineDate" type="date" className={inputClassName} {...register("customDeadlineDate")} /></FormField>
        </div>
      </section>

      <section className="space-y-5 border-t border-border pt-6">
        <FormField
          label="Engagement scope / internal notes"
          htmlFor="description"
          error={errors.description?.message}
          hint="Describe what is included, special circumstances, and exclusions. Example: 2026 MFJ Form 1040 with W-2 income and one Schedule C; federal and Louisiana included; bookkeeping cleanup excluded."
        >
          <textarea id="description" rows={4} className={inputClassName} {...register("description")} />
        </FormField>
      </section>

      <fieldset className="space-y-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">5. Activate this engagement</legend>
        {[
          ["save_draft", "Save draft", "Nothing is sent to the client."],
          ["activate_only", "Activate without sending", "The engagement opens for staff; intake remains unsent."],
          ["activate_and_send", "Activate & send intake", "Assign the organizer now and send portal access when needed."],
        ].map(([value, label, help]) => (
          <label key={value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-accent-50">
            <input className="mt-1" type="radio" value={value} {...register("activationMode")} />
            <span><span className="block text-sm font-medium text-foreground">{label}</span><span className="block text-xs text-muted">{help}</span></span>
          </label>
        ))}
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>Create engagement</Button>
      </div>
    </form>
  );
}
