"use client";

import { useState } from "react";
import { sendMessageAction } from "@/lib/actions/portal-messages";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";
import { cn, formatDateTime } from "@/lib/utils";
import type { Message } from "@/lib/types";

export function MessageThread({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  const submit = async () => {
    if (!body.trim()) return;
    setIsSending(true);
    const result = await sendMessageAction({ conversationId, body });
    setIsSending(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    setMessages((prev) => [
      ...prev,
      {
        id: `optimistic-${Date.now()}`,
        conversation_id: conversationId,
        workspace_id: "",
        sender_user_id: "",
        sender_type: "client",
        body,
        client_visible: true,
        attachment_document_id: null,
        read_at: null,
        created_at: new Date().toISOString(),
      },
    ]);
    setBody("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn("flex", message.sender_type === "client" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                message.sender_type === "client"
                  ? "bg-accent-600 text-white"
                  : "bg-slate-100 text-foreground",
              )}
            >
              <p>{message.body}</p>
              <p
                className={cn(
                  "mt-1 text-[11px]",
                  message.sender_type === "client" ? "text-accent-100" : "text-muted",
                )}
              >
                {message.sender_type === "client" ? "You" : "Your tax office"} ·{" "}
                {formatDateTime(message.created_at)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 border-t border-border pt-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Type a message…"
          className="flex-1 rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
        />
        <Button size="sm" onClick={submit} loading={isSending} disabled={!body.trim()}>
          Send
        </Button>
      </div>
    </div>
  );
}
