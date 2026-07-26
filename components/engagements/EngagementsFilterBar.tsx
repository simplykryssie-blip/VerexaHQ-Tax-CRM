"use client";

import { useState, useTransition } from "react";
import { FilterBar, selectClassName } from "@/components/ui/FilterBar";
import { SearchInput } from "@/components/ui/SearchInput";
import { useQueryParam } from "@/lib/hooks/useQueryParam";
import {
  engagementStatusOptions,
  engagementTypeOptions,
  returnTypeOptions,
  engagementPriorityOptions,
  dueDateStateOptions,
} from "@/lib/validation/engagements";
import { engagementStatusMeta, engagementTypeLabels, returnTypeLabels, engagementPriorityMeta, dueDateStateLabels } from "@/lib/status";
import type { UserSummary } from "@/lib/data/users";

export function EngagementsFilterBar({
  initialValues,
  staff,
}: {
  initialValues: {
    q: string;
    taxYear: string;
    status: string;
    returnType: string;
    engagementType: string;
    preparerUserId: string;
    reviewerUserId: string;
    priority: string;
    dueDateState: string;
  };
  staff: UserSummary[];
}) {
  const [q, setQ] = useState(initialValues.q);
  const setParam = useQueryParam();
  const [, startTransition] = useTransition();

  const set = (key: string, value: string) => startTransition(() => setParam(key, value));

  return (
    <FilterBar>
      <form
        className="flex flex-1 items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          set("q", q);
        }}
      >
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search by title or reference…"
          className="min-w-[200px] flex-1"
        />
      </form>

      <select className={selectClassName} value={initialValues.taxYear} onChange={(e) => set("taxYear", e.target.value)}>
        <option value="">All tax years</option>
        {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() + 1 - i).map((year) => (
          <option key={year} value={year}>
            {year}
          </option>
        ))}
      </select>

      <select className={selectClassName} value={initialValues.status} onChange={(e) => set("status", e.target.value)}>
        <option value="">All statuses</option>
        {engagementStatusOptions.map((status) => (
          <option key={status} value={status}>
            {engagementStatusMeta(status).label}
          </option>
        ))}
      </select>

      <select className={selectClassName} value={initialValues.engagementType} onChange={(e) => set("engagementType", e.target.value)}>
        <option value="">All engagement types</option>
        {engagementTypeOptions.map((type) => (
          <option key={type} value={type}>
            {engagementTypeLabels[type]}
          </option>
        ))}
      </select>

      <select className={selectClassName} value={initialValues.returnType} onChange={(e) => set("returnType", e.target.value)}>
        <option value="">All return types</option>
        {returnTypeOptions.map((type) => (
          <option key={type} value={type}>
            {returnTypeLabels[type]}
          </option>
        ))}
      </select>

      <select className={selectClassName} value={initialValues.priority} onChange={(e) => set("priority", e.target.value)}>
        <option value="">All priorities</option>
        {engagementPriorityOptions.map((priority) => (
          <option key={priority} value={priority}>
            {engagementPriorityMeta(priority).label}
          </option>
        ))}
      </select>

      <select className={selectClassName} value={initialValues.dueDateState} onChange={(e) => set("dueDateState", e.target.value)}>
        <option value="">Any due date</option>
        {dueDateStateOptions.map((state) => (
          <option key={state} value={state}>
            {dueDateStateLabels[state]}
          </option>
        ))}
      </select>

      <select className={selectClassName} value={initialValues.preparerUserId} onChange={(e) => set("preparerUserId", e.target.value)}>
        <option value="">All preparers</option>
        {staff.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.name}
          </option>
        ))}
      </select>

      <select className={selectClassName} value={initialValues.reviewerUserId} onChange={(e) => set("reviewerUserId", e.target.value)}>
        <option value="">All reviewers</option>
        {staff.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.name}
          </option>
        ))}
      </select>
    </FilterBar>
  );
}
