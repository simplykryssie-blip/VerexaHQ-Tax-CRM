"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createClientSchema,
  clientTypeOptions,
  type CreateClientInput,
} from "@/lib/validation/clients";
import { checkClientDuplicatesAction, createClientAction, type DuplicateMatch } from "@/lib/actions/clients";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { Button } from "@/components/ui/LegacyButton";
import { titleCase } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClientDuplicateWarningDrawer } from "@/features/clients/client-duplicate-warning-drawer";

export function ClientForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [pendingValues, setPendingValues] = useState<CreateClientInput | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema),
    defaultValues: { clientType: "individual", setupMode: "active", mailingSameAsPhysical: true, country: "US", mailingCountry: "US" },
  });
  const [email,phone,overrideReason,clientType,mailingSameAsPhysical]=useWatch({control,name:["email","phone","duplicateOverrideReason","clientType","mailingSameAsPhysical"]});

  useEffect(()=>{
    if(overrideReason)return;
    const timer=window.setTimeout(async()=>{
      if(!email && (phone??"").replace(/\D/g,"").length<7)return;
      const result=await checkClientDuplicatesAction({email,phone});
      if(result.duplicates?.length){setPendingValues(null);setDuplicates(result.duplicates);}
    },550);
    return()=>window.clearTimeout(timer);
  },[email,phone,overrideReason]);

  const save = async (data: CreateClientInput) => {
    setFormError(null);
    const result = await createClientAction(data);
    if (result.duplicates?.length) {
      setDuplicates(result.duplicates);
      setPendingValues(data);
      if (result.error) setFormError(result.error);
      return;
    }
    if (result?.error) {
      setFormError(result.error);
    } else if (result?.clientId) {
      router.push(
        result.next === "engagement"
          ? `/engagements/new?clientId=${result.clientId}`
          : `/clients/${result.clientId}`,
      );
    }
  };

  const onSubmit = async (data: CreateClientInput) => save(data);

  const continueAfterWarning = async (reason: string) => {
    setValue("duplicateOverrideReason",reason,{shouldDirty:true});
    setDuplicates([]);
    if (pendingValues) await save({ ...pendingValues, duplicateOverrideReason: reason });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {formError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
      )}

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
        <div />
      </div>

      {clientType === "business" ? (
        <>
          <FormField label="Business name" htmlFor="company" error={errors.company?.message} required>
            <input id="company" className={inputClassName} {...register("company")} />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Primary contact first name" htmlFor="firstName" error={errors.firstName?.message}>
              <input id="firstName" className={inputClassName} {...register("firstName")} />
            </FormField>
            <FormField label="Primary contact last name" htmlFor="lastName" error={errors.lastName?.message}>
              <input id="lastName" className={inputClassName} {...register("lastName")} />
            </FormField>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="First name" htmlFor="firstName" error={errors.firstName?.message} required>
            <input id="firstName" className={inputClassName} {...register("firstName")} />
          </FormField>
          <FormField label="Last name" htmlFor="lastName" error={errors.lastName?.message} required>
            <input id="lastName" className={inputClassName} {...register("lastName")} />
          </FormField>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" className={inputClassName} {...register("email")} />
        </FormField>
        <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
          <input id="phone" type="tel" className={inputClassName} {...register("phone")} />
        </FormField>
      </div>

      <fieldset className="space-y-3 rounded-xl border border-border p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">Physical address</legend>
        <FormField label="Address line 1" htmlFor="addressLine1" error={errors.addressLine1?.message}>
          <input id="addressLine1" className={inputClassName} {...register("addressLine1")} />
        </FormField>
        <FormField label="Address line 2" htmlFor="addressLine2" error={errors.addressLine2?.message}>
          <input id="addressLine2" className={inputClassName} {...register("addressLine2")} />
        </FormField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField label="City" htmlFor="city" error={errors.city?.message}>
            <input id="city" className={inputClassName} {...register("city")} />
          </FormField>
          <FormField label="State" htmlFor="state" error={errors.state?.message}>
            <input id="state" className={inputClassName} {...register("state")} />
          </FormField>
          <FormField label="ZIP / postal code" htmlFor="postalCode" error={errors.postalCode?.message}>
            <input id="postalCode" className={inputClassName} {...register("postalCode")} />
          </FormField>
        </div>
        <FormField label="Country" htmlFor="country" error={errors.country?.message}>
          <input id="country" className={inputClassName} {...register("country")} />
        </FormField>

        <label className="flex cursor-pointer items-center gap-2 pt-1 text-sm text-foreground">
          <input type="checkbox" className="accent-[var(--accent-600)]" {...register("mailingSameAsPhysical")} />
          Mailing address is the same as physical address
        </label>

        {mailingSameAsPhysical === false && (
          <div className="space-y-3 rounded-lg border border-border bg-slate-50/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Mailing address</p>
            <FormField label="Address line 1" htmlFor="mailingLine1" error={errors.mailingLine1?.message}>
              <input id="mailingLine1" className={inputClassName} {...register("mailingLine1")} />
            </FormField>
            <FormField label="Address line 2" htmlFor="mailingLine2" error={errors.mailingLine2?.message}>
              <input id="mailingLine2" className={inputClassName} {...register("mailingLine2")} />
            </FormField>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <FormField label="City" htmlFor="mailingCity" error={errors.mailingCity?.message}>
                <input id="mailingCity" className={inputClassName} {...register("mailingCity")} />
              </FormField>
              <FormField label="State" htmlFor="mailingState" error={errors.mailingState?.message}>
                <input id="mailingState" className={inputClassName} {...register("mailingState")} />
              </FormField>
              <FormField label="ZIP / postal code" htmlFor="mailingPostalCode" error={errors.mailingPostalCode?.message}>
                <input id="mailingPostalCode" className={inputClassName} {...register("mailingPostalCode")} />
              </FormField>
            </div>
            <FormField label="Country" htmlFor="mailingCountry" error={errors.mailingCountry?.message}>
              <input id="mailingCountry" className={inputClassName} {...register("mailingCountry")} />
            </FormField>
          </div>
        )}
      </fieldset>

      <FormField label="Notes" htmlFor="notes" error={errors.notes?.message}>
        <textarea id="notes" rows={4} className={inputClassName} {...register("notes")} />
      </FormField>

      <fieldset className="space-y-3 rounded-xl border border-border bg-slate-50/60 p-4">
        <legend className="px-1 text-sm font-semibold text-foreground">What happens next?</legend>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-white p-3">
          <input className="mt-1 accent-[var(--accent-600)]" type="radio" value="active" {...register("setupMode")} />
          <span>
            <span className="block text-sm font-medium text-foreground">Create client only</span>
            <span className="block text-xs text-muted">Create the client workspace without starting a tax engagement.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-white p-3">
          <input className="mt-1 accent-[var(--accent-600)]" type="radio" value="active_with_engagement" {...register("setupMode")} />
          <span>
            <span className="block text-sm font-medium text-foreground">Create active client</span>
            <span className="block text-xs text-muted">Continue to service, reviewer, deadline, and intake setup.</span>
          </span>
        </label>
      </fieldset>

      <div className="flex justify-end gap-2">
        <Link href="/clients">
          <Button type="button" variant="secondary">Cancel</Button>
        </Link>
        <Button type="submit" loading={isSubmitting}>
          Save client
        </Button>
      </div>
      <ClientDuplicateWarningDrawer
        open={duplicates.length > 0}
        matches={duplicates}
        onOpenChange={(open) => !open && setDuplicates([])}
        onContinue={continueAfterWarning}
      />
    </form>
  );
}
