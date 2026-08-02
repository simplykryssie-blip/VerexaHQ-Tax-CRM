"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { US_JURISDICTIONS } from "@/lib/tax/deadlines";
import { inputClassName } from "@/components/ui/FormField";

export function JurisdictionPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return US_JURISDICTIONS;
    return US_JURISDICTIONS.filter(([code, name]) =>
      code.toLowerCase().includes(term) || name.toLowerCase().includes(term),
    );
  }, [query]);

  const toggle = (code: string) => {
    onChange(value.includes(code) ? value.filter((item) => item !== code) : [...value, code]);
  };

  return (
    <div className="rounded-xl border border-border bg-white">
      <label className="relative block border-b border-border p-3">
        <Search className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={`${inputClassName} pl-9`}
          placeholder="Search state or code"
          aria-label="Search jurisdictions"
        />
      </label>
      <div className="max-h-52 overflow-y-auto p-2" role="group" aria-label="State jurisdictions">
        {filtered.map(([code, name]) => (
          <label key={code} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-accent-50">
            <input
              type="checkbox"
              checked={value.includes(code)}
              onChange={() => toggle(code)}
              className="size-4 accent-[var(--accent-600)]"
            />
            <span className="text-sm text-foreground">{name}</span>
            <span className="ml-auto text-xs font-medium text-muted">{code}</span>
          </label>
        ))}
      </div>
      <p className="border-t border-border px-3 py-2 text-xs text-muted">
        {value.length ? `${value.length} selected: ${value.join(", ")}` : "Federal only"}
      </p>
    </div>
  );
}
