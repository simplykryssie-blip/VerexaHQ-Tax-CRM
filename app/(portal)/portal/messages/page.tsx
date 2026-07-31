import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { listPortalConversations } from "@/lib/data/portal-messages";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { NewConversationForm } from "@/components/portal/messages/NewConversationForm";
import { Card, CardBody } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatRelativeTime } from "@/lib/utils";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";

export default async function PortalMessagesPage() {
  const { client } = await requirePortalAccess();
  if (!client) return <PortalNotLinkedState />;

  const supabase = await createClient();
  const conversations = await listPortalConversations(supabase, client.client.id);

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Messages" description="Secure messages with your tax office." />

      <NewConversationForm />

      {conversations.length === 0 ? (
        <PortalEmptyState icon={MessagesSquare} title="No conversations yet" />
      ) : (
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <Link key={conversation.id} href={`/portal/messages/${conversation.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardBody className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {conversation.subject || "Conversation"}
                    </p>
                    {conversation.lastMessage && (
                      <p className="mt-1 truncate text-sm text-muted">{conversation.lastMessage.body}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {conversation.unreadCount > 0 && (
                      <StatusBadge label={`${conversation.unreadCount} new`} tone="info" />
                    )}
                    <span className="text-xs text-muted">
                      {formatRelativeTime(conversation.last_message_at)}
                    </span>
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
