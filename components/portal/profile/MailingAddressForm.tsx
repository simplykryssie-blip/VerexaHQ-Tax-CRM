"use client";

import { useState } from "react";
import { updateMailingAddressAction } from "@/lib/actions/portal-profile";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/LegacyButton";
import { FormField, inputClassName } from "@/components/ui/FormField";
import type { ClientAddress } from "@/lib/types";

export function MailingAddressForm({ address }: { address: ClientAddress | null }) {
  const [line1, setLine1] = useState(address?.line1 ?? "");
  const [line2, setLine2] = useState(address?.line2 ?? "");
  const [city, setCity] = useState(address?.city ?? "");
  const [state, setState] = useState(address?.state ?? "");
  const [postalCode, setPostalCode] = useState(address?.postal_code ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    setIsSaving(true);
    const result = await updateMailingAddressAction({ line1, line2, city, state, postalCode });
    setIsSaving(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Mailing address updated.");
  };

  return (
    <div className="space-y-4">
      <FormField label="Street address">
        <input value={line1} onChange={(e) => setLine1(e.target.value)} className={inputClassName} />
      </FormField>
      <FormField label="Apt, suite, etc. (optional)">
        <input value={line2} onChange={(e) => setLine2(e.target.value)} className={inputClassName} />
      </FormField>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <FormField label="City">
          <input value={city} onChange={(e) => setCity(e.target.value)} className={inputClassName} />
        </FormField>
        <FormField label="State">
          <input value={state} onChange={(e) => setState(e.target.value)} className={inputClassName} />
        </FormField>
        <FormField label="ZIP code">
          <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputClassName} />
        </FormField>
      </div>
      <Button size="sm" onClick={submit} loading={isSaving}>
        Save
      </Button>
    </div>
  );
}
