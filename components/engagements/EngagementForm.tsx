"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createEngagementSchema,
  engagementPriorityValues,
  type CreateEngagementInput,
} from "@/lib/validation/engagements";
import { createEngagementAction } from "@/lib/actions/engagements";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/LegacyButton";
import type { Client } from "@/lib/types";
import type { ServiceOption } from "@/lib/data/engagements";
import { useRouter } from "next/navigation";

type ClientOption = Pick<Client, "id" | "first_name" | "last_name" | "business_name">;

function clientLabel(client: ClientOption) {
  return client.business_name || [client.first_name, client.last_name].filter(Boolean).join(" ") || "Unnamed client";
}

export function EngagementForm({ clients, services }: { clients: ClientOption[]; services: ServiceOption[] }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateEngagementInput>({
    resolver: zodResolver(createEngagementSchema),
    defaultValues: {
      priority: "Medium",
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
              {clientLabel(client)}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Service" htmlFor="serviceId" error={errors.serviceId?.message} required>
        <select id="serviceId" className={inputClassName} {...register("serviceId")} defaultValue="">
          <option value="" disabled>
            Select a service…
          </option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Priority" htmlFor="priority" error={errors.priority?.message}>
          <select id="priority" className={inputClassName} {...register("priority")}>
            {engagementPriorityValues.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Due date" htmlFor="dueDate" error={errors.dueDate?.message}>
          <input id="dueDate" type="date" className={inputClassName} {...register("dueDate")} />
        </FormField>
      </div>

      <FormField
        label="Internal reference"
        htmlFor="internalReference"
        error={errors.internalReference?.message}
        hint="Optional, staff-only reference (not shown to the client)."
      >
        <input id="internalReference" className={inputClassName} {...register("internalReference")} />
      </FormField>

      <div className="flex justify-end gap-2">
        <Button type="submit" loading={isSubmitting}>
          Create engagement
        </Button>
      </div>
    </form>
  );
}
