"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toaster";
import { convertLeadAction, getLeadDuplicateMatchesAction } from "@/lib/actions/leads";
import type { DuplicateMatch } from "@/lib/actions/clients";

export function ConvertLeadButton({ leadId, alreadyConverted }: { leadId: string; alreadyConverted: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [clientType, setClientType] = useState<"individual" | "business">("individual");
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  if (alreadyConverted) return null;

  async function inspect() {
    setLoading(true);
    const result = await getLeadDuplicateMatchesAction(leadId);
    setLoading(false);
    if (result.error) return toast.error(result.error);
    setDuplicates(result.duplicates ?? []);
  }

  async function convert(existingClientId?: string) {
    setLoading(true);
    const result = await convertLeadAction({ leadId, clientType, existingClientId, overrideReason: existingClientId ? undefined : overrideReason || undefined });
    setLoading(false);
    if (result.error) return toast.error(result.error);
    toast.success(result.success!);
    setOpen(false);
    router.push(`/clients/${result.clientId}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) void inspect(); }}>
      <DialogTrigger asChild><Button variant="brand" size="sm"><UserPlus className="h-4 w-4" /> Convert to client</Button></DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Convert lead to client</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5"><Label>Client type</Label><Select value={clientType} onValueChange={(value) => setClientType(value as typeof clientType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="business">Business</SelectItem></SelectContent></Select></div>
          {loading && duplicates === null ? <p className="text-sm text-muted-foreground">Checking for existing clients…</p> : duplicates?.length ? (
            <div className="space-y-3">
              <p className="text-sm font-medium text-amber-700">Possible existing client records found</p>
              {duplicates.map((match) => <div key={match.clientId} className="rounded-lg border border-amber-200 bg-amber-50/60 p-3"><div className="flex items-start justify-between gap-2"><div><p className="font-medium">{match.displayName}</p><p className="text-xs text-muted-foreground">{match.maskedEmail || match.maskedPhone}</p></div><Badge variant="secondary">{match.status}</Badge></div><div className="mt-2 flex gap-1">{match.reasons.map((reason) => <Badge variant="warning" key={reason}>{reason}</Badge>)}</div><Button className="mt-3 w-full" variant="outline" size="sm" disabled={loading} onClick={() => convert(match.clientId)}>Link lead to this client</Button></div>)}
              <div className="space-y-1.5"><Label>Or explain why this is a separate client</Label><Textarea value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="Required and recorded in the audit log" /></div>
            </div>
          ) : <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">No matching client was found. Verexa will create a new client workspace.</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button variant="brand" disabled={loading || duplicates === null || (!!duplicates.length && overrideReason.trim().length < 8)} onClick={() => convert()}>{loading && <Loader2 className="size-4 animate-spin" />}{duplicates?.length ? "Create separate client" : "Create client"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
