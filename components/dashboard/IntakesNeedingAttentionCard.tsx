import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/LegacyCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { intakeSubmissionStatusMeta } from "@/lib/status";
import { clientDisplayName, formatRelativeTime } from "@/lib/utils";
import type { IntakeWithClient } from "@/lib/data/dashboard";

export function IntakesNeedingAttentionCard({ intakes }: { intakes: IntakeWithClient[] }) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Intakes needing attention</h2>
        <Link href="/intakes" className="text-sm text-accent-700 hover:underline">
          View queue
        </Link>
      </CardHeader>
      <CardBody className="p-0">
        {intakes.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={ClipboardCheck} title="Nothing needs attention" description="All active intakes are on track." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {intakes.map((intake) => {
              const status = intakeSubmissionStatusMeta(intake.status);
              return (
                <li key={intake.id}>
                  <Link
                    href={`/intakes/${intake.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-accent-50/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {intake.client ? clientDisplayName(intake.client) : "Unknown client"}
                      </p>
                      <p className="text-xs text-muted">
                        Tax year {intake.tax_year ?? "—"} · {intake.progress_percent}% complete
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge label={status.label} tone={status.tone} />
                      <span className="text-xs text-muted">{formatRelativeTime(intake.updated_at)}</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
