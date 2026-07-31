"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
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
import { Button } from "@/components/ui/Button";
import { clientDisplayName } from "@/lib/utils";
import type { Client } from "@/lib/types";
import type { UserSummary } from "@/lib/data/users";
import { useRouter } from "next/navigation";

type ClientOption = Pick<Client, "id" | "first_name" | "last_name" | "display_name" | "preferred_name" | "company">;

const currentYear = new Date().getFullYear();

type EngagementFormInput = z.input<typeof createEngagementSchema>;

export function EngagementForm({ clients, staff }: { clients: ClientOption[]; staff: UserSummary[] }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EngagementFormInput, unknown, CreateEngagementInput>({
    resolver: zodResolver(createEngagementSchema),
    defaultValues: {
      status: "draft",
      priority: "normal",
      taxYear: currentYear,
      engagementType: "individual",
      federalReturnRequired: true,
      stateReturnRequired: false,
      localReturnRequired: false,
    },
  });

  const onSubmit = async (data: CreateEngagementInput) => {
    setFormError(null);
    const result = await createEngagementAction(data);
    if (result?.error) {
      setFormError(result.error);
    } else if (result?.engagementId) {
      router.push(`/engagements/${result.engagementId}`);
    } else {
      router.push("/engagements");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {formError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}

      <FormField label="Client" htmlFor="clientId" error={errors.clientId?.message} required>
        <select id="clientId" className={inputClassName} {...register("clientId")} defaultValue="">
          <option value="" disabled>
            Select a client…
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {clientDisplayName(client)}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Title" htmlFor="title" error={errors.title?.message} required>
        <input id="title" className={inputClassName} placeholder="e.g. 2025 Individual Form 1040" {...register("title")} />
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
          <select id="returnType" className={inputClassName} {...register("returnType")} defaultValue="">
            <option value="">Not selected</option>
            {returnTypeOptions.map((type) => (
              <option key={type} value={type}>
                {returnTypeLabels[type]}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="Priority" htmlFor="priority" error={errors.priority?.message}>
          <select id="priority" className={inputClassName} {...register("priority")}>
            {engagementPriorityOptions.map((priority) => (
              <option key={priority} value={priority}>
                {engagementPriorityMeta(priority).label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Preparer" htmlFor="preparerUserId" error={errors.preparerUserId?.message} hint="Optional at creation.">
          <select id="preparerUserId" className={inputClassName} {...register("preparerUserId")} defaultValue="">
            <option value="">Unassigned</option>
            {staff.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Reviewer" htmlFor="reviewerUserId" error={errors.reviewerUserId?.message} hint="Optional at creation.">
          <select id="reviewerUserId" className={inputClassName} {...register("reviewerUserId")} defaultValue="">
            <option value="">Unassigned</option>
            {staff.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Due date" htmlFor="dueDate" error={errors.dueDate?.message}>
          <input id="dueDate" type="date" className={inputClassName} {...register("dueDate")} />
        </FormField>
        <FormField label="Internal due date" htmlFor="internalDueDate" error={errors.internalDueDate?.message} hint="Staff-only target, not shown to the client.">
          <input id="internalDueDate" type="date" className={inputClassName} {...register("internalDueDate")} />
        </FormField>
      </div>

      <FormField label="Jurisdiction" htmlFor="jurisdiction" error={errors.jurisdiction?.message} hint="e.g. CA, NY — leave blank for federal-only.">
        <input id="jurisdiction" className={inputClassName} {...register("jurisdiction")} />
      </FormField>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" {...register("federalReturnRequired")} />
          Federal return required
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" {...register("stateReturnRequired")} />
          State return required
        </label>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input type="checkbox" {...register("localReturnRequired")} />
          Local return required
        </label>
      </div>

      <FormField label="Description" htmlFor="description" error={errors.description?.message}>
        <textarea id="description" rows={3} className={inputClassName} {...register("description")} />
      </FormField>

      <div className="flex justify-end gap-2">
        <Button type="submit" loading={isSubmitting}>
          Create engagement
        </Button>
      </div>
    </form>
  );
}
