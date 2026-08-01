import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Conversation, Message } from "@/lib/types";

export type PortalConversation = Conversation & {
  lastMessage: Pick<Message, "body" | "sender_type" | "created_at"> | null;
  unreadCount: number;
};

export async function listPortalConversations(
  supabase: SupabaseServerClient,
  clientId: string,
): Promise<PortalConversation[]> {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("client_id", clientId)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  if (error || !data) return [];

  type MessageSummary = Pick<Message, "conversation_id" | "body" | "sender_type" | "created_at" | "read_at" | "client_visible">;

  const conversationIds = data.map((c) => c.id);
  const { data: messages } = conversationIds.length
    ? await supabase
        .from("messages")
        .select("conversation_id, body, sender_type, created_at, read_at, client_visible")
        .in("conversation_id", conversationIds)
        .eq("client_visible", true)
        .order("created_at", { ascending: true })
    : { data: [] as MessageSummary[] };

  const byConversation = new Map<string, MessageSummary[]>();
  for (const message of messages ?? []) {
    const list = byConversation.get(message.conversation_id) ?? [];
    list.push(message);
    byConversation.set(message.conversation_id, list);
  }

  return data.map((conversation) => {
    const list = byConversation.get(conversation.id) ?? [];
    const last = list[list.length - 1] ?? null;
    const unreadCount = list.filter((m) => m.sender_type === "staff" && !m.read_at).length;
    return {
      ...conversation,
      lastMessage: last
        ? { body: last.body, sender_type: last.sender_type, created_at: last.created_at }
        : null,
      unreadCount,
    };
  });
}

export async function countUnreadMessages(
  supabase: SupabaseServerClient,
  clientId: string,
): Promise<number> {
  const conversations = await listPortalConversations(supabase, clientId);
  return conversations.reduce((sum, c) => sum + c.unreadCount, 0);
}

export async function getPortalConversationDetail(
  supabase: SupabaseServerClient,
  clientId: string,
  conversationId: string,
): Promise<{ conversation: Conversation; messages: Message[] } | null> {
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("*")
    // Ownership verified explicitly, not left to RLS alone.
    .eq("client_id", clientId)
    .eq("id", conversationId)
    .maybeSingle();

  if (error || !conversation) return null;

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("client_visible", true)
    .order("created_at", { ascending: true });

  return { conversation, messages: messages ?? [] };
}
