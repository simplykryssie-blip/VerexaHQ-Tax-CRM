"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { startConversationAction } from "@/lib/actions/portal-messages";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/LegacyButton";
import { Card, CardBody, CardHeader } from "@/components/ui/LegacyCard";

export function NewConversationForm() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const submit = async () => {
    setIsSubmitting(true);
    const result = await startConversationAction({ subject: subject || undefined, body });
    setIsSubmitting(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Message sent.");
    if (result.conversationId) router.push(`/portal/messages/${result.conversationId}`);
  };

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-foreground">New message</h2>
      </CardHeader>
      <CardBody className="space-y-3">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="block w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="What would you like to ask your tax office?"
          className="block w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={submit} loading={isSubmitting} disabled={!body.trim()}>
            Send
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
