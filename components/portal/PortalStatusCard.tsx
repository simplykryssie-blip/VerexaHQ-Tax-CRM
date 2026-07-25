import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TONE_CLASSES: Record<string, string> = {
  neutral: "bg-slate-100 text-slate-600",
  accent: "bg-accent-50 text-accent-600",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-red-50 text-red-600",
};

export function PortalStatusCard({
  icon: Icon,
  title,
  description,
  href,
  tone = "accent",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  tone?: "neutral" | "accent" | "warning" | "danger";
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm transition-shadow hover:shadow-md"
    >
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", TONE_CLASSES[tone])}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>
      <ArrowRight className="mt-1 size-4 shrink-0 text-slate-400" />
    </Link>
  );
}
