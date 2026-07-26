import { FolderOpen, MessageCircleQuestion, ClipboardList, MessagesSquare, Briefcase } from "lucide-react";
import { PortalStatusCard } from "@/components/portal/PortalStatusCard";
import type { PortalDashboardData } from "@/lib/data/portal-dashboard";

export function PortalActionCardsGrid({ data }: { data: PortalDashboardData }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <PortalStatusCard
        icon={Briefcase}
        title="Your engagements"
        description={
          data.activeEngagementsCount > 0
            ? `${data.activeEngagementsCount} active engagement${data.activeEngagementsCount === 1 ? "" : "s"}`
            : "No active engagements"
        }
        href="/portal/engagements"
        tone="neutral"
      />
      <PortalStatusCard
        icon={FolderOpen}
        title="Upload missing documents"
        description={
          data.missingDocumentsCount > 0
            ? `${data.missingDocumentsCount} document${data.missingDocumentsCount === 1 ? "" : "s"} needed`
            : "You're all caught up"
        }
        href="/portal/document-requests"
        tone={data.missingDocumentsCount > 0 ? "warning" : "neutral"}
      />
      <PortalStatusCard
        icon={MessageCircleQuestion}
        title="Respond to a clarification"
        description={
          data.openClarificationCount > 0
            ? `${data.openClarificationCount} open question${data.openClarificationCount === 1 ? "" : "s"}`
            : "No open questions"
        }
        href="/portal/clarifications"
        tone={data.openClarificationCount > 0 ? "warning" : "neutral"}
      />
      <PortalStatusCard
        icon={ClipboardList}
        title="Review document requests"
        description="See everything your tax office has asked for"
        href="/portal/document-requests"
        tone="neutral"
      />
      <PortalStatusCard
        icon={MessagesSquare}
        title="Contact your tax office"
        description="Send a secure message"
        href="/portal/messages"
        tone="neutral"
      />
    </div>
  );
}
