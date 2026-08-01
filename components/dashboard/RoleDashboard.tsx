import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RoleDashboardHero({
  eyebrow,
  title,
  description,
  actions = [],
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: { href: string; label: string }[];
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-brand-gradient p-6 text-white shadow-sm md:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-white/75">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold md:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-white/80">{description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className="rounded-lg border border-white/20 bg-white/10 px-3.5 py-2.5 text-sm font-semibold hover:bg-white/20"
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function RoleMetric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  helper: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </div>
        <div className="mt-4 text-3xl font-bold tabular-nums">{value}</div>
        <div className="mt-1 text-sm font-semibold">{label}</div>
        <div className="mt-1 text-xs text-muted-foreground">{helper}</div>
      </CardContent>
    </Card>
  );
}

export function DashboardSection({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        {href && (
          <Link href={href} className="flex items-center gap-1 text-xs font-semibold text-primary">
            View all <ArrowRight className="size-3.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function DashboardEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
