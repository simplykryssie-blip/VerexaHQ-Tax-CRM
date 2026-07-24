import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/status";

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-600/10",
  info: "bg-sky-50 text-sky-700 ring-sky-600/20",
  warning: "bg-amber-50 text-amber-700 ring-amber-600/20",
  success: "bg-accent-50 text-accent-700 ring-accent-600/20",
  danger: "bg-red-50 text-red-700 ring-red-600/20",
};

export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}
