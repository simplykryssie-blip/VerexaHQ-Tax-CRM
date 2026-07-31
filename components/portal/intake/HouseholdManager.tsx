"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { householdPersonSchema, type HouseholdPersonInput } from "@/lib/validation/portal-intake";
import { saveHouseholdPersonAction, deleteHouseholdPersonAction } from "@/lib/actions/portal-intake";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Users } from "lucide-react";
import type { IntakeHouseholdPerson } from "@/lib/types";

export function HouseholdManager({
  submissionId,
  people,
  disabled,
}: {
  submissionId: string;
  people: IntakeHouseholdPerson[];
  disabled: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null | "new">(null);

  if (editingId !== null) {
    const editing = editingId === "new" ? null : people.find((p) => p.id === editingId) ?? null;
    return (
      <HouseholdPersonForm
        submissionId={submissionId}
        person={editing}
        onDone={() => setEditingId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {people.length === 0 ? (
        <Card>
          <CardBody>
            <PortalEmptyState
              icon={Users}
              title="No household members added yet"
              description="Add anyone else in your household, like a spouse or dependent."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {people.map((person) => (
            <Card key={person.id}>
              <CardBody className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {person.first_name} {person.last_name}
                  </p>
                  <p className="text-xs text-muted">{person.relationship || "Household member"}</p>
                </div>
                {!disabled && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingId(person.id)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                      aria-label="Edit"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <ConfirmDialog
                      title="Remove household member"
                      description={`Remove ${person.first_name} ${person.last_name} from this intake?`}
                      confirmLabel="Remove"
                      destructive
                      onConfirm={async () => {
                        const result = await deleteHouseholdPersonAction({ submissionId, id: person.id });
                        if (result?.error) toast.error(result.error);
                        return result;
                      }}
                      trigger={
                        <button className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                          <Trash2 className="size-4" />
                        </button>
                      }
                    />
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {!disabled && (
        <Button size="sm" variant="secondary" onClick={() => setEditingId("new")}>
          <Plus className="size-4" /> Add household member
        </Button>
      )}
    </div>
  );
}

function HouseholdPersonForm({
  submissionId,
  person,
  onDone,
}: {
  submissionId: string;
  person: IntakeHouseholdPerson | null;
  onDone: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<HouseholdPersonInput>({
    resolver: zodResolver(householdPersonSchema),
    defaultValues: {
      submissionId,
      personId: person?.id,
      firstName: person?.first_name ?? "",
      lastName: person?.last_name ?? "",
      dateOfBirth: person?.date_of_birth ?? undefined,
      ssnLast4: person?.ssn_last4 ?? undefined,
      relationship: person?.relationship ?? undefined,
      monthsInHome: person?.months_in_home ?? undefined,
      isStudent: person?.is_student ?? undefined,
      isDisabled: person?.is_disabled ?? undefined,
      occupation: person?.occupation ?? undefined,
    },
  });

  const onSubmit = async (data: HouseholdPersonInput) => {
    const result = await saveHouseholdPersonAction(data);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Household member saved.");
    onDone();
  };

  return (
    <Card>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="First name" error={errors.firstName?.message} required>
              <input className={inputClassName} {...register("firstName")} />
            </FormField>
            <FormField label="Last name" error={errors.lastName?.message} required>
              <input className={inputClassName} {...register("lastName")} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Date of birth" error={errors.dateOfBirth?.message}>
              <input type="date" className={inputClassName} {...register("dateOfBirth")} />
            </FormField>
            <FormField label="SSN (last 4 digits)" error={errors.ssnLast4?.message} hint="Only the last 4 digits — never the full SSN.">
              <input maxLength={4} className={inputClassName} {...register("ssnLast4")} />
            </FormField>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Relationship to you" error={errors.relationship?.message}>
              <input className={inputClassName} placeholder="e.g. Son, Daughter, Spouse" {...register("relationship")} />
            </FormField>
            <FormField label="Months lived with you" error={errors.monthsInHome?.message}>
              <input
                type="number"
                min={0}
                max={12}
                className={inputClassName}
                {...register("monthsInHome", { valueAsNumber: true })}
              />
            </FormField>
          </div>
          <FormField label="Occupation" error={errors.occupation?.message}>
            <input className={inputClassName} {...register("occupation")} />
          </FormField>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" className="size-4 rounded border-border text-accent-600" {...register("isStudent")} />
              Full-time student
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" className="size-4 rounded border-border text-accent-600" {...register("isDisabled")} />
              Disabled
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={isSubmitting}>
              Save
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
