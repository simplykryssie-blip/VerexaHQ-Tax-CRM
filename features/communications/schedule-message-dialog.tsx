"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import { toast } from "@/components/ui/toaster";

export type CommunicationClient = { id: string; label: string; email: string | null; phone: string | null };

export function ScheduleMessageDialog({ workspaceId, clients }: { workspaceId: string; clients: CommunicationClient[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const selected = useMemo(() => clients.find((client) => client.id === clientId), [clients, clientId]);
  const recipient = channel === "email" ? selected?.email : selected?.phone;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !recipient || !body.trim()) {
      setError(`Choose a client with a ${channel === "email" ? "valid email address" : "valid phone number"} and enter a message.`);
      return;
    }
    setSubmitting(true);
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("queue_communication", {
      p_workspace_id: workspaceId,
      p_channel: channel,
      p_recipient: recipient,
      p_subject: channel === "email" ? subject || undefined : undefined,
      p_body_text: body.trim(),
      p_client_id: selected.id,
      p_scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
      p_metadata: { source: "staff_communications_hub" },
    });
    setSubmitting(false);
    if (rpcError) {
      setError(friendlyDbError(rpcError.message));
      return;
    }
    toast.success(scheduledFor ? "Message scheduled" : "Message queued");
    setOpen(false);
    setBody("");
    setSubject("");
    setScheduledFor("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="brand" size="sm"><Clock3 className="h-4 w-4" /> Schedule message</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule email or text</DialogTitle></DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <div className="space-y-1"><Label>Client *</Label><Select value={clientId} onValueChange={setClientId}><SelectTrigger><SelectValue placeholder="Choose client" /></SelectTrigger><SelectContent>{clients.map((client) => <SelectItem key={client.id} value={client.id}>{client.label}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-1"><Label>Channel *</Label><Select value={channel} onValueChange={(value) => setChannel(value as "email" | "sms")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="sms">Text message</SelectItem></SelectContent></Select>{selected && !recipient && <p className="text-xs text-destructive">This client does not have a {channel === "email" ? "email address" : "phone number"}.</p>}</div>
          {channel === "email" && <div className="space-y-1"><Label>Subject</Label><Input value={subject} onChange={(event) => setSubject(event.target.value)} /></div>}
          <div className="space-y-1"><Label>Message *</Label><Textarea rows={5} value={body} onChange={(event) => setBody(event.target.value)} /></div>
          <div className="space-y-1"><Label>Send time</Label><Input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} /><p className="text-xs text-muted-foreground">Leave blank to send as soon as the provider is available.</p></div>
          <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="brand" disabled={submitting}>{submitting && <Loader2 className="h-4 w-4 animate-spin" />}Queue message</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

