"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePortalAccess } from "@/lib/auth/portal";
import {
  sendMessageSchema,
  startConversationSchema,
  type SendMessageInput,
  type StartConversationInput,
} from "@/lib/validation/portal-messages";

type ActionResult = { error?: string; success?: true; conversationId?: string };

export async function startConversationAction(input: StartConversationInput): Promise<ActionResult> {
  const parsed = startConversationSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { client, user } = await requirePortalAccess();
  if (!client) return { error: "No linked client account." };

  const supabase = await createClient();

  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({
      workspace_id: client.client.workspace_id,
      client_id: client.client.id,
      subject: parsed.data.subject || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !conversation) return { error: "We couldn't start the conversation. Please try again." };

  const { error: messageError } = await supabase.from("messages").insert({
    workspace_id: client.client.workspace_id,
    conversation_id: conversation.id,
    sender_user_id: user.id,
    sender_type: "client",
    body: parsed.data.body,
  });

  if (messageError) return { error: "We couldn't send your message. Please try again." };

  revalidatePath("/portal/messages");
  return { success: true, conversationId: conversation.id };
}

export async function sendMessageAction(input: SendMessageInput): Promise<ActionResult> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const { client, user } = await requirePortalAccess();
  if (!client) return { error: "No linked client account." };

  const supabase = await createClient();

  // Ownership verified explicitly — never trust the conversation id alone.
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, workspace_id")
    .eq("client_id", client.client.id)
    .eq("id", parsed.data.conversationId)
    .maybeSingle();

  if (!conversation) return { error: "Conversation not found." };

  const { error } = await supabase.from("messages").insert({
    workspace_id: conversation.workspace_id,
    conversation_id: conversation.id,
    sender_user_id: user.id,
    sender_type: "client",
    body: parsed.data.body,
  });

  if (error) return { error: "We couldn't send your message. Please try again." };

  revalidatePath(`/portal/messages/${conversation.id}`);
  revalidatePath("/portal/messages");
  return { success: true };
}

export async function markConversationReadAction(conversationId: string): Promise<ActionResult> {
  const { client } = await requirePortalAccess();
  if (!client) return { error: "No linked client account." };

  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("client_id", client.client.id)
    .eq("id", conversationId)
    .maybeSingle();

  if (!conversation) return { error: "Conversation not found." };

  // Only staff-sent messages can be "unread" from the client's perspective.
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("sender_type", "staff")
    .is("read_at", null);

  revalidatePath("/portal/messages");
  return { success: true };
}
