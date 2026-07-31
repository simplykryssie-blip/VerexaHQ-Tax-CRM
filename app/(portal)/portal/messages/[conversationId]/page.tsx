import { notFound } from "next/navigation";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { getPortalConversationDetail } from "@/lib/data/portal-messages";
import { markConversationReadAction } from "@/lib/actions/portal-messages";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { MessageThread } from "@/components/portal/messages/MessageThread";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";

export default async function PortalConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { client } = await requirePortalAccess();
  if (!client) return <PortalNotLinkedState />;

  const { conversationId } = await params;
  const supabase = await createClient();
  const detail = await getPortalConversationDetail(supabase, client.client.id, conversationId);
  if (!detail) notFound();

  await markConversationReadAction(conversationId);

  return (
    <div className="space-y-6">
      <PortalPageHeader title={detail.conversation.subject || "Conversation"} />
      <Card>
        <CardBody>
          <MessageThread conversationId={conversationId} initialMessages={detail.messages} />
        </CardBody>
      </Card>
    </div>
  );
}
