import { cn } from "@/lib/utils";

export function FormField({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-foreground"
      >
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export const inputClassName = cn(
  "block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm placeholder:text-slate-400",
  "focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20",
  "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted",
);
