"use client";

import { useTransition } from "react";
import { FilterBar, selectClassName } from "@/components/ui/FilterBar";
import { useQueryParam } from "@/lib/hooks/useQueryParam";
import { intakeSubmissionStatusMeta } from "@/lib/status";
import type { UserSummary } from "@/lib/data/users";

const STATUS_OPTIONS = [
  "not_started",
  "in_progress",
  "submitted",
  "changes_requested",
  "resubmitted",
  "under_review",
  "approved",
  "rejected",
  "archived",
] as const;

export function IntakesFilterBar({
  years,
  reviewers,
  current,
}: {
  years: number[];
  reviewers: UserSummary[];
  current: {
    taxYear: string;
    status: string;
    reviewer: string;
    missingDocuments: string;
    clarificationNeeded: string;
    validationFailures: string;
    completion: string;
  };
}) {
  const setParam = useQueryParam();
  const [, startTransition] = useTransition();

  const set = (key: string, value: string) => startTransition(() => setParam(key, value));

  return (
    <FilterBar>
      <select className={selectClassName} value={current.taxYear} onChange={(e) => set("taxYear", e.target.value)}>
        <option value="">All tax years</option>
        {years.map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>

      <select className={selectClassName} value={current.status} onChange={(e) => set("status", e.target.value)}>
        <option value="">All statuses</option>
        {STATUS_OPTIONS.map((status) => (
          <option key={status} value={status}>
            {intakeSubmissionStatusMeta(status).label}
          </option>
        ))}
      </select>

      {reviewers.length > 0 && (
        <select className={selectClassName} value={current.reviewer} onChange={(e) => set("reviewer", e.target.value)}>
          <option value="">All reviewers</option>
          {reviewers.map((reviewer) => (
            <option key={reviewer.userId} value={reviewer.userId}>
              {reviewer.name}
            </option>
          ))}
        </select>
      )}

      <select className={selectClassName} value={current.completion} onChange={(e) => set("completion", e.target.value)}>
        <option value="">Any completion</option>
        <option value="complete">Complete</option>
        <option value="incomplete">Incomplete</option>
      </select>

      <label className="flex items-center gap-1.5 text-sm text-foreground">
        <input
          type="checkbox"
          checked={current.missingDocuments === "1"}
          onChange={(e) => set("missingDocuments", e.target.checked ? "1" : "")}
          className="size-4 rounded border-border text-accent-600 focus:ring-accent-500"
        />
        Missing documents
      </label>

      <label className="flex items-center gap-1.5 text-sm text-foreground">
        <input
          type="checkbox"
          checked={current.clarificationNeeded === "1"}
          onChange={(e) => set("clarificationNeeded", e.target.checked ? "1" : "")}
          className="size-4 rounded border-border text-accent-600 focus:ring-accent-500"
        />
        Clarification needed
      </label>

      <label className="flex items-center gap-1.5 text-sm text-foreground">
        <input
          type="checkbox"
          checked={current.validationFailures === "1"}
          onChange={(e) => set("validationFailures", e.target.checked ? "1" : "")}
          className="size-4 rounded border-border text-accent-600 focus:ring-accent-500"
        />
        Validation failures
      </label>
    </FilterBar>
  );
}
