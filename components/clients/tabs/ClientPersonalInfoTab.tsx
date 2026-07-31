"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { Client } from "@/lib/types";
import { personalInfoSchema, type PersonalInfoInput, filingStatusOptions } from "@/lib/validation/clients-extended";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { titleCase } from "@/lib/utils";

interface ClientPersonalInfoTabProps {
  client: Client;
  workspaceId: string;
  onUpdate?: () => void;
}

export function ClientPersonalInfoTab({ client, workspaceId, onUpdate }: ClientPersonalInfoTabProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<PersonalInfoInput>({
    resolver: zodResolver(personalInfoSchema),
    defaultValues: {
      firstName: client.first_name,
      middleName: client.middle_name || "",
      lastName: client.last_name,
      suffix: client.suffix || "",
      dateOfBirth: client.date_of_birth || "",
      filingStatus: (client.filing_status as any) || "",
      email: client.email || "",
      occupation: client.occupation || "",
      drivingLicenseNumber: client.id_number || "",
      drivingLicenseState: client.id_state || "",
      drivingLicenseExpiration: client.id_expiration || "",
      preferredLanguage: client.preferred_language || "",
    },
  });

  const onSubmit = async (data: PersonalInfoInput) => {
    setFormError(null);
    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: data.firstName,
          middleName: data.middleName,
          lastName: data.lastName,
          suffix: data.suffix,
          dateOfBirth: data.dateOfBirth,
          filingStatus: data.filingStatus,
          email: data.email,
          occupation: data.occupation,
          idNumber: data.drivingLicenseNumber,
          idState: data.drivingLicenseState,
          idExpiration: data.drivingLicenseExpiration,
          preferredLanguage: data.preferredLanguage,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        setFormError(error.message || "Failed to update client");
        return;
      }

      setIsEditing(false);
      onUpdate?.();
    } catch (err) {
      setFormError("An error occurred while saving");
    }
  };

  if (!isEditing) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-gray-700">First Name</p>
            <p className="mt-1 text-sm text-gray-900">{client.first_name}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Middle Name</p>
            <p className="mt-1 text-sm text-gray-900">{client.middle_name || "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Last Name</p>
            <p className="mt-1 text-sm text-gray-900">{client.last_name}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Date of Birth</p>
            <p className="mt-1 text-sm text-gray-900">{client.date_of_birth || "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Filing Status</p>
            <p className="mt-1 text-sm text-gray-900">{client.filing_status ? titleCase(client.filing_status) : "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-gray-700">Email</p>
            <p className="mt-1 text-sm text-gray-900">{client.email || "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Occupation</p>
            <p className="mt-1 text-sm text-gray-900">{client.occupation || "—"}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm font-medium text-gray-700">ID Number</p>
            <p className="mt-1 text-sm text-gray-900">{client.id_number || "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">ID State</p>
            <p className="mt-1 text-sm text-gray-900">{client.id_state || "—"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">ID Expiration</p>
            <p className="mt-1 text-sm text-gray-900">{client.id_expiration || "—"}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => setIsEditing(true)} variant="secondary">
            Edit
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {formError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="First Name" htmlFor="firstName" error={errors.firstName?.message} required>
          <input id="firstName" className={inputClassName} {...register("firstName")} />
        </FormField>
        <FormField label="Middle Name" htmlFor="middleName" error={errors.middleName?.message}>
          <input id="middleName" className={inputClassName} {...register("middleName")} />
        </FormField>
        <FormField label="Last Name" htmlFor="lastName" error={errors.lastName?.message} required>
          <input id="lastName" className={inputClassName} {...register("lastName")} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Date of Birth" htmlFor="dateOfBirth" error={errors.dateOfBirth?.message}>
          <input id="dateOfBirth" type="date" className={inputClassName} {...register("dateOfBirth")} />
        </FormField>
        <FormField label="Filing Status" htmlFor="filingStatus" error={errors.filingStatus?.message}>
          <select id="filingStatus" className={inputClassName} {...register("filingStatus")}>
            <option value="">Select filing status</option>
            {filingStatusOptions.map((option) => (
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
        <FormField label="Occupation" htmlFor="occupation" error={errors.occupation?.message}>
          <input id="occupation" className={inputClassName} {...register("occupation")} />
        </FormField>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="ID Number" htmlFor="drivingLicenseNumber" error={errors.drivingLicenseNumber?.message}>
          <input id="drivingLicenseNumber" className={inputClassName} {...register("drivingLicenseNumber")} />
        </FormField>
        <FormField label="ID State" htmlFor="drivingLicenseState" error={errors.drivingLicenseState?.message}>
          <input id="drivingLicenseState" className={inputClassName} {...register("drivingLicenseState")} />
        </FormField>
        <FormField label="ID Expiration" htmlFor="drivingLicenseExpiration" error={errors.drivingLicenseExpiration?.message}>
          <input id="drivingLicenseExpiration" type="date" className={inputClassName} {...register("drivingLicenseExpiration")} />
        </FormField>
      </div>

      <div className="flex justify-end gap-2">
        <Button onClick={() => { setIsEditing(false); reset(); }} variant="secondary">
          Cancel
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Save Changes
        </Button>
      </div>
    </form>
  );
}
