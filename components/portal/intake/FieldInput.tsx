import { inputClassName } from "@/components/ui/FormField";
import { cn } from "@/lib/utils";
import type { FormField as FormFieldRow } from "@/lib/types";

export type FieldInputProps = {
  field: Pick<FormFieldRow, "component_type" | "label" | "is_required" | "options" | "help_text">;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled?: boolean;
};

/**
 * Renders one input for a schema-defined form field, purely controlled
 * (value in, onChange out) — no persistence of its own. DynamicField wraps
 * this with per-field autosave into intake_answers for generic sections;
 * HouseholdPersonForm/RepeatableEntityForm use it directly and batch-save
 * into intake_household_people / intake_repeatable_entities instead.
 */
export function FieldInput({ field, value, onChange, disabled }: FieldInputProps) {
  const label = (
    <label className="text-sm font-medium text-foreground">
      {field.label}
      {field.is_required && <span className="text-red-600"> *</span>}
    </label>
  );

  const wrap = (input: React.ReactNode) => (
    <div className="space-y-1.5">
      {label}
      {input}
      {field.help_text && <p className="text-xs text-muted">{field.help_text}</p>}
    </div>
  );

  switch (field.component_type) {
    case "heading":
      return <h3 className="text-base font-semibold text-foreground">{field.label}</h3>;
    case "paragraph":
      return <p className="text-sm text-muted">{field.label}</p>;
    case "divider":
      return <hr className="border-border" />;

    case "textarea":
      return wrap(
        <textarea
          disabled={disabled}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={inputClassName}
        />,
      );

    case "number":
      return wrap(
        <input
          type="number"
          disabled={disabled}
          value={(value as number) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={inputClassName}
        />,
      );

    case "currency":
      return wrap(
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
          <input
            type="number"
            step="0.01"
            disabled={disabled}
            value={(value as number) ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            className={cn(inputClassName, "pl-6")}
          />
        </div>,
      );

    case "date":
      return wrap(
        <input
          type="date"
          disabled={disabled}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={inputClassName}
        />,
      );

    case "email":
      return wrap(
        <input
          type="email"
          disabled={disabled}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        />,
      );

    case "phone":
      return wrap(
        <input
          type="tel"
          disabled={disabled}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        />,
      );

    case "yes_no": {
      const current = value as boolean | null | undefined;
      return wrap(
        <div className="flex gap-2">
          {[
            { label: "Yes", val: true },
            { label: "No", val: false },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.val)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                current === option.val
                  ? "border-accent-500 bg-accent-50 text-accent-700"
                  : "border-border text-foreground hover:bg-slate-50",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>,
      );
    }

    case "single_choice":
    case "dropdown": {
      const options = Array.isArray(field.options) ? (field.options as string[]) : [];
      return wrap(
        <select
          disabled={disabled}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={inputClassName}
        >
          <option value="">Select…</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>,
      );
    }

    case "multiple_choice": {
      const options = Array.isArray(field.options) ? (field.options as string[]) : [];
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return wrap(
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                disabled={disabled}
                checked={selected.includes(option)}
                onChange={(e) => {
                  const next = e.target.checked
                    ? [...selected, option]
                    : selected.filter((o) => o !== option);
                  onChange(next);
                }}
                className="size-4 rounded border-border text-accent-600 focus:ring-accent-500"
              />
              {option}
            </label>
          ))}
        </div>,
      );
    }

    case "address": {
      const address = (value as Record<string, string>) ?? {};
      const updateAddress = (key: string, val: string) => onChange({ ...address, [key]: val });
      return wrap(
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <input
            disabled={disabled}
            value={address.line1 ?? ""}
            onChange={(e) => updateAddress("line1", e.target.value)}
            placeholder="Street address"
            className={cn(inputClassName, "sm:col-span-2")}
          />
          <input
            disabled={disabled}
            value={address.line2 ?? ""}
            onChange={(e) => updateAddress("line2", e.target.value)}
            placeholder="Apt, suite, etc. (optional)"
            className={cn(inputClassName, "sm:col-span-2")}
          />
          <input
            disabled={disabled}
            value={address.city ?? ""}
            onChange={(e) => updateAddress("city", e.target.value)}
            placeholder="City"
            className={inputClassName}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              disabled={disabled}
              value={address.state ?? ""}
              onChange={(e) => updateAddress("state", e.target.value)}
              placeholder="State"
              className={inputClassName}
            />
            <input
              disabled={disabled}
              value={address.postal_code ?? ""}
              onChange={(e) => updateAddress("postal_code", e.target.value)}
              placeholder="ZIP code"
              className={inputClassName}
            />
          </div>
        </div>,
      );
    }

    case "signature":
      return wrap(
        <input
          disabled={disabled}
          value={(value as { typedName?: string })?.typedName ?? ""}
          onChange={(e) => onChange(e.target.value ? { typedName: e.target.value, signedAt: new Date().toISOString() } : null)}
          placeholder="Type your full legal name to sign"
          className={inputClassName}
        />,
      );

    case "file_upload":
      return wrap(
        <p className="rounded-lg border border-dashed border-border bg-slate-50 px-3 py-2 text-sm text-muted">
          Upload this from the{" "}
          <a href="/portal/document-requests" className="font-medium text-accent-700 hover:underline">
            Documents
          </a>{" "}
          section.
        </p>,
      );

    case "calculation":
      return wrap(
        <p className={cn(inputClassName, "bg-slate-50 text-muted")}>
          {value !== null && value !== undefined ? String(value) : "Calculated automatically"}
        </p>,
      );

    default:
      return wrap(
        <input
          disabled={disabled}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputClassName}
        />,
      );
  }
}

export function fieldDefaultValue(componentType: string): unknown {
  if (componentType === "multiple_choice") return [];
  if (componentType === "address" || componentType === "signature") return {};
  return null;
}
