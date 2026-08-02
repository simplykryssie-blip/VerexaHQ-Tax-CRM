"use client";

import Link from "next/link";
import { useState } from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import type { DuplicateMatch } from "@/lib/actions/clients";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export function ClientDuplicateWarningDrawer({
  open,
  matches,
  onOpenChange,
  onContinue,
}: {
  open: boolean;
  matches: DuplicateMatch[];
  onOpenChange: (open: boolean) => void;
  onContinue: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function continueAnyway() {
    if (reason.trim().length < 8) return;
    setSaving(true);
    await onContinue(reason.trim());
    setSaving(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md overflow-y-auto bg-background p-6 text-foreground sm:w-[440px]">
        <div className="pr-6">
          <div className="flex size-11 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="size-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold">Possible duplicate client</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Verexa found matching contact information. Open the existing file before creating another taxpayer record.
          </p>
        </div>

        <div className="mt-5 space-y-3">
          {matches.map((match) => (
            <div key={match.clientId} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{match.displayName || "Existing client"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{match.maskedEmail || match.maskedPhone || "Contact information matched"}</p>
                </div>
                <Badge variant="secondary">{match.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {match.reasons.map((reasonItem) => <Badge key={reasonItem} variant="warning">Matches {reasonItem}</Badge>)}
              </div>
              <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                <Link href={`/clients/${match.clientId}`} target="_blank">Open client file <ExternalLink className="size-3.5" /></Link>
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <Label htmlFor="duplicate-reason">Why is this a separate client?</Label>
          <Textarea id="duplicate-reason" value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2" rows={3} placeholder="Required to continue and saved in the audit log" />
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button variant="brand" className="flex-1" disabled={reason.trim().length < 8 || saving} onClick={continueAnyway}>Create separately</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
