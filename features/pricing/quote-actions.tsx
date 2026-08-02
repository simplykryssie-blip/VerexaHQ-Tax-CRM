"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { expireQuoteAction, sendQuoteAction } from "@/lib/actions/pricing";

export function StaffQuoteActions({ id, status, canSend }: { id: string; status: string; canSend: boolean }) {
  const [pending, start] = useTransition(); const router = useRouter();
  if (!canSend || !["draft","sent","viewed"].includes(status)) return null;
  const run = (kind: "send"|"expire") => start(async () => { const result = kind === "send" ? await sendQuoteAction(id) : await expireQuoteAction(id); if (result.error) toast.error(result.error); else { toast.success(result.success!); router.refresh(); } });
  return <div className="flex gap-2">{status === "draft" && <Button variant="brand" disabled={pending} onClick={() => run("send")}>Send to portal</Button>}<Button variant="outline" disabled={pending} onClick={() => run("expire")}>Expire quote</Button></div>;
}
