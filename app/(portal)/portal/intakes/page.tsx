import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { listPortalIntakes } from "@/lib/data/portal-intakes";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { Card, CardBody } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { friendlyIntakeStatusMeta } from "@/lib/portal-copy";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";

export default async function PortalIntakesPage() {
  const { client } = await requirePortalAccess();
  if (!client) return <PortalNotLinkedState />;

  const supabase = await createClient();
  const intakes = await listPortalIntakes(supabase, client.client.id);

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Tax Organizer" description="Your tax organizer for each year." />

      {intakes.length === 0 ? (
        <PortalEmptyState
          icon={FileText}
          title="No tax intake yet"
          description="Your tax office will set up your intake — check back soon."
        />
      ) : (
        <div className="space-y-3">
          {intakes.map((intake) => {
            const status = friendlyIntakeStatusMeta(intake.status);
            return (
              <Link key={intake.id} href={`/portal/organizer/${intake.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardBody className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        Tax year {intake.tax_year ?? "—"}
                      </p>
                      <p className="mt-1 text-sm text-muted">{intake.progress_percent}% complete</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge label={status.label} tone={status.tone} />
                      <ArrowRight className="size-4 text-slate-400" />
                    </div>
                  </CardBody>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
