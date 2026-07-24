"use client";

import { useTransition } from "react";
import { FilterBar, selectClassName } from "@/components/ui/FilterBar";
import { useQueryParam } from "@/lib/hooks/useQueryParam";
import { documentRequestStatusMeta } from "@/lib/status";

const STATUS_OPTIONS = [
  "draft",
  "sent",
  "viewed",
  "in_progress",
  "partially_complete",
  "completed",
  "cancelled",
  "expired",
] as const;

export function DocumentRequestsFilterBar({
  status,
  missingDocuments,
}: {
  status: string;
  missingDocuments: string;
}) {
  const setParam = useQueryParam();
  const [, startTransition] = useTransition();

  return (
    <FilterBar>
      <select
        className={selectClassName}
        value={status}
        onChange={(e) => startTransition(() => setParam("status", e.target.value))}
      >
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {documentRequestStatusMeta(option).label}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-1.5 text-sm text-foreground">
        <input
          type="checkbox"
          checked={missingDocuments === "1"}
          onChange={(e) => startTransition(() => setParam("missingDocuments", e.target.checked ? "1" : ""))}
          className="size-4 rounded border-border text-accent-600 focus:ring-accent-500"
        />
        Missing documents only
      </label>
    </FilterBar>
  );
}
