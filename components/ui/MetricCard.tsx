import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  tone?: "neutral" | "accent" | "warning" | "danger";
  href?: string;
}) {
  const toneClasses: Record<string, string> = {
    neutral: "bg-slate-100 text-slate-600",
    accent: "bg-accent-50 text-accent-600",
    warning: "bg-amber-50 text-amber-600",
    danger: "bg-red-50 text-red-600",
  };

  const content = (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md">
      {Icon && (
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            toneClasses[tone],
          )}
        >
          <Icon className="size-5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
        <p className="truncate text-sm text-muted">{label}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }

  return content;
}
