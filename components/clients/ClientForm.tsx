"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createClientSchema,
  clientTypeOptions,
  clientStatusOptions,
  type CreateClientInput,
} from "@/lib/validation/clients";
import { createClientAction } from "@/lib/actions/clients";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/LegacyButton";
import { titleCase } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function ClientForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { clientType: "individual", status: "lead" },
  });

  const onSubmit = async (data: CreateClientInput) => {
    setFormError(null);
    const result = await createClientAction(data);
    if (result?.error) {
      setFormError(result.error);
    } else {
      router.refresh();
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

      <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
        <textarea id="notes" rows={4} className={inputClassName} {...register("notes")} />
      </FormField>

      <div className="flex justify-end gap-2">
        <Button type="submit" loading={isSubmitting}>
          Save client
        </Button>
      </div>
    </form>
  );
}
