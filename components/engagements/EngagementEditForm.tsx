"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import {
  updateEngagementSchema,
  engagementTypeOptions,
  returnTypeOptions,
  engagementPriorityOptions,
  type UpdateEngagementInput,
  type EngagementTypeOption,
} from "@/lib/validation/engagements";
import { updateEngagementAction } from "@/lib/actions/engagements";
import { engagementTypeLabels, returnTypeLabels, engagementPriorityMeta } from "@/lib/status";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/LegacyButton";
import type { TaxEngagement } from "@/lib/types";
import { JurisdictionPicker } from "@/components/engagements/JurisdictionPicker";

type EngagementEditFormInput = z.input<typeof updateEngagementSchema>;

const isCurrentEngagementType = (value: string): value is EngagementTypeOption =>
  (engagementTypeOptions as readonly string[]).includes(value);

export function EngagementEditForm({ engagement }: { engagement: TaxEngagement }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const metadata = (engagement.metadata && typeof engagement.metadata === "object" && !Array.isArray(engagement.metadata)
    ? engagement.metadata
    : {}) as Record<string, unknown>;
  const staffDeadlines = (metadata.staff_deadlines && typeof metadata.staff_deadlines === "object"
    ? metadata.staff_deadlines
    : {}) as Record<string, unknown>;
  const savedJurisdictions = Array.isArray(metadata.jurisdictions)
    ? metadata.jurisdictions.filter((value): value is string => typeof value === "string")
    : engagement.jurisdiction?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EngagementEditFormInput, unknown, UpdateEngagementInput>({
    resolver: zodResolver(updateEngagementSchema),
    defaultValues: {
      title: engagement.title,
      taxYear: engagement.tax_year,
      engagementType: isCurrentEngagementType(engagement.engagement_type) ? engagement.engagement_type : "other",
      returnType: engagement.return_type ?? "",
      priority: engagement.priority,
      internalDueDate: engagement.internal_due_date ?? "",
      jurisdictions: savedJurisdictions,
      fiscalYearEnd: (metadata.fiscal_year_end as string | null) ?? "",
      extensionFiled: engagement.extension_filed,
      clientDocumentDueDate: (staffDeadlines.client_document_deadline as string | null) ?? "",
      reviewerDueDate: (staffDeadlines.reviewer_deadline as string | null) ?? "",
      signatureDueDate: (staffDeadlines.signature_deadline as string | null) ?? "",
      federalReturnRequired: engagement.federal_return_required,
      stateReturnRequired: engagement.state_return_required,
      localReturnRequired: engagement.local_return_required,
      description: engagement.description ?? "",
      balanceDue: engagement.balance_due ?? undefined,
      refundAmount: engagement.refund_amount ?? undefined,
    },
  });

  const onSubmit = async (data: UpdateEngagementInput) => {
    setFormError(null);
    const result = await updateEngagementAction(engagement.id, data);
    if (result?.error) {
      setFormError(result.error);
      return;
    }
    router.push(`/engagements/${engagement.id}`);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

      <FormField label="Title" htmlFor="title" error={errors.title?.message} required>
        <input id="title" className={inputClassName} {...register("title")} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Tax year" htmlFor="taxYear" error={errors.taxYear?.message} required>
          <input id="taxYear" type="number" className={inputClassName} {...register("taxYear")} />
        </FormField>
        <FormField label="Engagement type" htmlFor="engagementType" error={errors.engagementType?.message} required>
          <select id="engagementType" className={inputClassName} {...register("engagementType")}>
            {engagementTypeOptions.map((type) => (
              <option key={type} value={type}>
                {engagementTypeLabels[type]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Return type" htmlFor="returnType" error={errors.returnType?.message}>
          <select id="returnType" className={inputClassName} {...register("returnType")}>
            <option value="">Not selected</option>
            {returnTypeOptions.map((type) => (
              <option key={type} value={type}>
                {returnTypeLabels[type]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Priority" htmlFor="priority" error={errors.priority?.message}>
          <select id="priority" className={inputClassName} {...register("priority")}>
            {engagementPriorityOptions.map((priority) => (
              <option key={priority} value={priority}>
                {engagementPriorityMeta(priority).label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Fiscal-year end" htmlFor="fiscalYearEnd" hint="Leave blank for calendar-year returns.">
          <input id="fiscalYearEnd" type="date" className={inputClassName} {...register("fiscalYearEnd")} />
        </FormField>
      </div>

      <div className="rounded-lg border border-accent-200 bg-accent-50 p-3 text-sm text-foreground">
        Statutory filing and extension dates are recalculated automatically when you save the return type, tax year, fiscal-year end, or jurisdictions.
      </div>

      <Controller
        name="jurisdictions"
        control={control}
        render={({ field }) => <JurisdictionPicker value={field.value ?? []} onChange={field.onChange} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Internal due date" htmlFor="internalDueDate" error={errors.internalDueDate?.message} hint="Staff-only target, not shown to the client.">
          <input id="internalDueDate" type="date" className={inputClassName} {...register("internalDueDate")} />
        </FormField>
        <label className="flex min-h-11 items-center gap-2 self-end pb-2 text-sm text-foreground">
          <input type="checkbox" {...register("extensionFiled")} /> Extension filed or accepted
        </label>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" {...register("federalReturnRequired")} />
          Federal return required
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" {...register("localReturnRequired")} />
          Local return required
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Client document deadline" htmlFor="clientDocumentDueDate"><input id="clientDocumentDueDate" type="date" className={inputClassName} {...register("clientDocumentDueDate")} /></FormField>
        <FormField label="Reviewer deadline" htmlFor="reviewerDueDate"><input id="reviewerDueDate" type="date" className={inputClassName} {...register("reviewerDueDate")} /></FormField>
        <FormField label="Signature deadline" htmlFor="signatureDueDate"><input id="signatureDueDate" type="date" className={inputClassName} {...register("signatureDueDate")} /></FormField>
      </div>

      <FormField label="Engagement scope / internal notes" htmlFor="description" error={errors.description?.message} hint="Record included work, special circumstances, and exclusions.">
        <textarea id="description" rows={3} className={inputClassName} {...register("description")} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Balance due"
          htmlFor="balanceDue"
          error={errors.balanceDue?.message}
          hint="Leave blank if not applicable. Cannot be set together with a refund amount."
        >
          <input id="balanceDue" type="number" step="0.01" min="0" className={inputClassName} {...register("balanceDue")} />
        </FormField>
        <FormField
          label="Refund amount"
          htmlFor="refundAmount"
          error={errors.refundAmount?.message}
          hint="Leave blank if not applicable. Cannot be set together with a balance due."
        >
          <input id="refundAmount" type="number" step="0.01" min="0" className={inputClassName} {...register("refundAmount")} />
        </FormField>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" loading={isSubmitting}>
          Save changes
        </Button>
      </div>
    </form>
  );
}
