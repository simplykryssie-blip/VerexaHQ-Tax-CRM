"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createClientSchema,
  clientTypeOptions,
  clientStatusOptions,
  CONTACT_METHODS,
  type CreateClientInput,
} from "@/lib/validation/clients";
import { createClientAction, updateClientAction } from "@/lib/actions/clients";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/LegacyButton";
import { titleCase } from "@/lib/utils";
import type { Client } from "@/lib/types";

export function ClientForm({ client }: { client?: Client }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: client
      ? {
          firstName: client.first_name ?? "",
          lastName: client.last_name ?? "",
          clientType: client.client_type,
          status: client.status as CreateClientInput["status"],
          email: client.email ?? "",
          phone: client.phone ?? "",
          company: client.company ?? "",
          notes: client.notes ?? "",
          dateOfBirth: client.date_of_birth ?? "",
          ssnLast4: client.ssn_last4 ?? "",
          einLast4: client.ein_last4 ?? "",
          preferredContactMethod: (client.preferred_contact_method as CreateClientInput["preferredContactMethod"]) ?? undefined,
          source: client.source ?? "",
        }
      : { clientType: "individual", status: "lead" },
  });

  const onSubmit = async (data: CreateClientInput) => {
    setFormError(null);
    const result = client ? await updateClientAction(client.id, data) : await createClientAction(data);
    if (result?.error) {
      setFormError(result.error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {formError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="First name" htmlFor="firstName" error={errors.firstName?.message} required>
          <input id="firstName" className={inputClassName} {...register("firstName")} />
        </FormField>
        <FormField label="Last name" htmlFor="lastName" error={errors.lastName?.message} required>
          <input id="lastName" className={inputClassName} {...register("lastName")} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Client type" htmlFor="clientType" error={errors.clientType?.message} required>
          <select id="clientType" className={inputClassName} {...register("clientType")}>
            {clientTypeOptions.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Status" htmlFor="status" error={errors.status?.message} required>
          <select id="status" className={inputClassName} {...register("status")}>
            {clientStatusOptions.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" className={inputClassName} {...register("email")} />
        </FormField>
        <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
          <input id="phone" type="tel" className={inputClassName} {...register("phone")} />
        </FormField>
      </div>

      <FormField label="Company" htmlFor="company" error={errors.company?.message} hint="Optional — for business or organization clients.">
        <input id="company" className={inputClassName} {...register("company")} />
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Date of birth" htmlFor="dateOfBirth" error={errors.dateOfBirth?.message}>
          <input id="dateOfBirth" type="date" className={inputClassName} {...register("dateOfBirth")} />
        </FormField>
        <FormField label="Preferred contact method" htmlFor="preferredContactMethod" error={errors.preferredContactMethod?.message}>
          <select id="preferredContactMethod" className={inputClassName} {...register("preferredContactMethod")}>
            <option value="">Select…</option>
            {CONTACT_METHODS.map((option) => (
              <option key={option} value={option}>
                {titleCase(option)}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="SSN — last 4 digits" htmlFor="ssnLast4" error={errors.ssnLast4?.message}>
          <input id="ssnLast4" maxLength={4} placeholder="1234" className={inputClassName} {...register("ssnLast4")} />
        </FormField>
        <FormField label="EIN — last 4 digits" htmlFor="einLast4" error={errors.einLast4?.message}>
          <input id="einLast4" maxLength={4} placeholder="1234" className={inputClassName} {...register("einLast4")} />
        </FormField>
      </div>

      <FormField label="Source" htmlFor="source" error={errors.source?.message} hint="Referral, website, converted lead…">
        <input id="source" className={inputClassName} {...register("source")} />
      </FormField>

      <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
        <textarea id="notes" rows={4} className={inputClassName} {...register("notes")} />
      </FormField>

      <div className="flex justify-end gap-2">
        <Button type="submit" loading={isSubmitting}>
          {client ? "Save changes" : "Save client"}
        </Button>
      </div>
    </form>
  );
}
