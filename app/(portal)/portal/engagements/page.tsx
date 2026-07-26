import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { listPortalEngagements } from "@/lib/data/portal-engagements";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { Card, CardBody } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { friendlyEngagementStatusMeta } from "@/lib/portal-copy";
import { returnTypeLabels } from "@/lib/status";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";

export default async function PortalEngagementsPage() {
  const { client } = await requirePortalAccess();
  if (!client) return <PortalNotLinkedState />;

  const supabase = await createClient();
  const engagements = await listPortalEngagements(supabase, client.client.id);

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Engagements" description="Your tax engagements with our office." />

      {engagements.length === 0 ? (
        <PortalEmptyState icon={ClipboardList} title="No engagements yet" />
      ) : (
        <div className="space-y-3">
          {engagements.map((engagement) => {
            const status = friendlyEngagementStatusMeta(engagement.status);
            return (
              <Link key={engagement.id} href={`/portal/engagements/${engagement.id}`}>
                <Card className="transition-shadow hover:shadow-md">
                  <CardBody className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{engagement.title}</p>
                      <p className="text-xs text-muted">
                        Tax year {engagement.tax_year ?? "—"}
                        {engagement.return_type
                          ? ` · ${returnTypeLabels[engagement.return_type as keyof typeof returnTypeLabels] ?? engagement.return_type}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
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
