import { FileText, FolderOpen, MessageCircleQuestion, MessagesSquare } from "lucide-react";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { getMostRecentIntake } from "@/lib/data/portal-intakes";
import { countMissingDocuments } from "@/lib/data/portal-document-requests";
import { countOpenClarifications, listPortalClarifications } from "@/lib/data/portal-clarifications";
import { countUnreadMessages, listPortalConversations } from "@/lib/data/portal-messages";
import type { PortalActivityItem } from "@/components/portal/PortalActivityTimeline";
import type { IntakeSubmission } from "@/lib/types";

export type PortalNextAction = {
  title: string;
  description: string;
  href: string;
  icon: typeof FileText;
  tone: "neutral" | "accent" | "warning" | "danger";
};

export type PortalDashboardData = {
  currentIntake: IntakeSubmission | null;
  missingDocumentsCount: number;
  openClarificationCount: number;
  unreadMessagesCount: number;
  recentActivity: PortalActivityItem[];
  nextAction: PortalNextAction | null;
};

export async function getPortalDashboardData(
  supabase: SupabaseServerClient,
  clientId: string,
): Promise<PortalDashboardData> {
  const [currentIntake, missingDocumentsCount, openClarificationCount, unreadMessagesCount, clarifications, conversations] =
    await Promise.all([
      getMostRecentIntake(supabase, clientId),
      countMissingDocuments(supabase, clientId),
      countOpenClarifications(supabase, clientId),
      countUnreadMessages(supabase, clientId),
      listPortalClarifications(supabase, clientId),
      listPortalConversations(supabase, clientId),
    ]);

  const recentActivity: PortalActivityItem[] = [];

  for (const c of clarifications.slice(0, 5)) {
    recentActivity.push({
      id: `clarification-${c.id}`,
      label: c.resolved_at
        ? "A clarification you answered was resolved"
        : "Your tax office asked a question about your intake",
      timestamp: c.resolved_at ?? c.created_at,
      icon: MessageCircleQuestion,
    });
  }

  for (const conversation of conversations.slice(0, 5)) {
    if (conversation.lastMessage) {
      recentActivity.push({
        id: `message-${conversation.id}`,
        label:
          conversation.lastMessage.sender_type === "staff"
            ? "New message from your tax office"
            : "You sent a message",
        timestamp: conversation.lastMessage.created_at,
        icon: MessagesSquare,
      });
    }
  }

  if (currentIntake) {
    recentActivity.push({
      id: `intake-${currentIntake.id}`,
      label: `Your ${currentIntake.tax_year ?? ""} tax intake was updated`,
      timestamp: currentIntake.updated_at,
      icon: FileText,
    });
  }

  recentActivity.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

  let nextAction: PortalNextAction | null = null;

  if (openClarificationCount > 0) {
    nextAction = {
      title: "Respond to a clarification",
      description: "Your tax office needs more information from you.",
      href: "/portal/clarifications",
      icon: MessageCircleQuestion,
      tone: "warning",
    };
  } else if (missingDocumentsCount > 0) {
    nextAction = {
      title: "Upload missing documents",
      description: `${missingDocumentsCount} document${missingDocumentsCount === 1 ? "" : "s"} still needed.`,
      href: "/portal/document-requests",
      icon: FolderOpen,
      tone: "warning",
    };
  } else if (currentIntake && currentIntake.status === "in_progress") {
    nextAction = {
      title: "Continue your tax intake",
      description: `${currentIntake.progress_percent}% complete — pick up where you left off.`,
      href: `/portal/intakes/${currentIntake.id}`,
      icon: FileText,
      tone: "accent",
    };
  } else if (currentIntake && currentIntake.status === "not_started") {
    nextAction = {
      title: "Start your tax intake",
      description: "Let's get your tax information collected.",
      href: `/portal/intakes/${currentIntake.id}`,
      icon: FileText,
      tone: "accent",
    };
  }

  return {
    currentIntake,
    missingDocumentsCount,
    openClarificationCount,
    unreadMessagesCount,
    recentActivity: recentActivity.slice(0, 6),
    nextAction,
  };
}
