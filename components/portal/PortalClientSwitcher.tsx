"use client";

import { useTransition } from "react";
import { switchClientAction } from "@/lib/actions/portal";
import type { ClientLink } from "@/lib/auth/portal";
import { selectClassName } from "@/components/ui/FilterBar";
import { clientDisplayName } from "@/lib/utils";

export function PortalClientSwitcher({
  links,
  currentClientId,
}: {
  links: ClientLink[];
  currentClientId: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (links.length <= 1) return null;

  return (
    <select
      defaultValue={currentClientId}
      disabled={isPending}
      onChange={(event) => {
        const formData = new FormData();
        formData.set("clientId", event.target.value);
        startTransition(() => switchClientAction(formData));
      }}
      className={selectClassName}
      aria-label="Switch client account"
    >
      {links.map((link) => (
        <option key={link.client.id} value={link.client.id}>
          {clientDisplayName(link.client)}
        </option>
      ))}
    </select>
  );
}
