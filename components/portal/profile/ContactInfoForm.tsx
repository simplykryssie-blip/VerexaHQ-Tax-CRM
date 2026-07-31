"use client";

import { useState } from "react";
import { updateContactInfoAction } from "@/lib/actions/portal-profile";
import { contactMethodOptions } from "@/lib/validation/portal-profile";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/LegacyButton";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { titleCase } from "@/lib/utils";
import type { Client } from "@/lib/types";

export function ContactInfoForm({ client }: { client: Client }) {
  const [phone, setPhone] = useState(client.phone ?? "");
  const [preferredContactMethod, setPreferredContactMethod] = useState(
    client.preferred_contact_method ?? "email",
  );
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    setIsSaving(true);
    const result = await updateContactInfoAction({ phone, preferredContactMethod });
    setIsSaving(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Contact information updated.");
  };

  return (
    <div className="space-y-4">
      <FormField label="Phone">
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClassName} />
      </FormField>
      <FormField label="Preferred contact method">
        <select
          value={preferredContactMethod}
          onChange={(e) => setPreferredContactMethod(e.target.value as typeof preferredContactMethod)}
          className={inputClassName}
        >
          {contactMethodOptions.map((option) => (
            <option key={option} value={option}>
              {titleCase(option)}
            </option>
          ))}
        </select>
      </FormField>
      <Button size="sm" onClick={submit} loading={isSaving}>
        Save
      </Button>
    </div>
  );
}
