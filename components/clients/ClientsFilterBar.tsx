"use client";

import { useState, useTransition } from "react";
import { FilterBar, selectClassName } from "@/components/ui/FilterBar";
import { SearchInput } from "@/components/ui/SearchInput";
import { useQueryParam } from "@/lib/hooks/useQueryParam";
import { clientStatusOptions } from "@/lib/validation/clients";
import { titleCase } from "@/lib/utils";

export function ClientsFilterBar({
  initialQ,
  initialStatus,
}: {
  initialQ: string;
  initialStatus: string;
}) {
  const [q, setQ] = useState(initialQ);
  const setParam = useQueryParam();
  const [, startTransition] = useTransition();

  return (
    <FilterBar>
      <form
        className="flex flex-1 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(() => setParam("q", q));
        }}
      >
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search by name, company, or email…"
          className="min-w-[220px] flex-1"
        />
      </form>
      <select
        className={selectClassName}
        value={initialStatus}
        onChange={(event) => startTransition(() => setParam("status", event.target.value))}
      >
        <option value="">All statuses</option>
        {clientStatusOptions.map((status) => (
          <option key={status} value={status}>
            {titleCase(status)}
          </option>
        ))}
      </select>
    </FilterBar>
  );
}
