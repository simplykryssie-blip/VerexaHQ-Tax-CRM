"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/LegacyButton";
import { toast } from "@/lib/toast";
import { sendOrganizerReminderAction } from "@/lib/actions/organizer";

const DEFAULT_MESSAGE =
  "This is a friendly reminder that your tax organizer is still waiting to be completed. Please sign in to your portal when you have a chance.";

export function SendReminderDialog({ submissionId }: { submissionId: string }) {
  const dialogOpenRef = useState(false);
  const [open, setOpen] = dialogOpenRef;
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const [isSending, setIsSending] = useState(false);

  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Bell className="size-4" /> Send Reminder
      </Button>
    );
  }

  const send = async () => {
    setIsSending(true);
    const result = await sendOrganizerReminderAction({ submissionId, message });
    setIsSending(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Reminder sent.");
    setOpen(false);
    setMessage(DEFAULT_MESSAGE);
  };

  return (
    <div className="space-y-2 rounded-lg border border-border p-3">
      <label className="text-xs font-medium text-muted">Reminder message</label>
      <textarea
        rows={3}
        className="block w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" loading={isSending} onClick={send}>
          Send
        </Button>
      </div>
    </div>
  );
}
