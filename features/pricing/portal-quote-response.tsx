"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import { respondToQuoteAction } from "@/lib/actions/pricing";

export function PortalQuoteResponse({ quoteId }: { quoteId: string }) {
  const [name, setName] = useState(""); const [pending, start] = useTransition(); const router = useRouter();
  const respond = (response: "accept"|"decline") => start(async () => { if (response === "accept" && name.trim().length < 2) { toast.error("Enter your full name to accept."); return; } const result = await respondToQuoteAction(quoteId,response,name); if (result.error) toast.error(result.error); else { toast.success(result.success!); router.refresh(); } });
  return <div className="space-y-3 rounded-xl border border-accent-200 bg-accent-50 p-4"><div><Label htmlFor="acceptedBy">Full name</Label><Input id="acceptedBy" value={name} onChange={event => setName(event.target.value)} placeholder="Type your full legal name"/></div><p className="text-xs text-muted">By accepting, you confirm the displayed service scope and preliminary pricing. Additional work requires a separate change order.</p><div className="flex flex-wrap gap-2"><Button variant="brand" disabled={pending} onClick={() => respond("accept")}>Accept quote</Button><Button variant="outline" disabled={pending} onClick={() => respond("decline")}>Decline</Button></div></div>;
}
