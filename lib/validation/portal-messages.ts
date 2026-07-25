import { z } from "zod";

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1, "Enter a message.").max(4000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const startConversationSchema = z.object({
  subject: z.string().trim().max(200).optional(),
  body: z.string().trim().min(1, "Enter a message.").max(4000),
});
export type StartConversationInput = z.infer<typeof startConversationSchema>;
