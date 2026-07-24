import { MessageCircleQuestion } from "lucide-react";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { listPortalClarifications } from "@/lib/data/portal-clarifications";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { ClarificationCard } from "@/components/portal/clarifications/ClarificationCard";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";

export default async function PortalClarificationsPage() {
  const { client } = await requirePortalAccess();
  if (!client) return <PortalNotLinkedState />;

  const supabase = await createClient();
  const clarifications = await listPortalClarifications(supabase, client.client.id);

  const open = clarifications.filter((c) => !c.resolved_at);
  const resolved = clarifications.filter((c) => c.resolved_at);

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Clarifications" description="Questions from your tax office about your intake." />

      {clarifications.length === 0 ? (
        <PortalEmptyState icon={MessageCircleQuestion} title="No clarifications right now" />
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Needs your response</h2>
              {open.map((c) => (
                <ClarificationCard key={c.id} clarification={c} />
              ))}
            </div>
          )}
          {resolved.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-foreground">Resolved</h2>
              {resolved.map((c) => (
                <ClarificationCard key={c.id} clarification={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
