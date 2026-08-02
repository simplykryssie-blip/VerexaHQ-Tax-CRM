"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { setLeadStageAction } from "@/lib/actions/leads";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/validation/leads";

export function LeadStageSelect({ leadId, value, disabled = false }: { leadId: string; value: (typeof LEAD_STATUSES)[number]; disabled?: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <Select value={value} disabled={disabled || pending} onValueChange={(next) => {
      const reason = ["lost","do_not_contact"].includes(next) ? window.prompt("Reason required")?.trim() : undefined;
      if (["lost","do_not_contact"].includes(next) && !reason) return;
      startTransition(async () => {
        const result = await setLeadStageAction(leadId, next as (typeof LEAD_STATUSES)[number], reason);
        if (result.error) toast.error(result.error); else { toast.success(result.success!); router.refresh(); }
      });
    }}>
      <SelectTrigger className="h-8 min-w-44 text-xs" onClick={(event) => event.preventDefault()}><SelectValue /></SelectTrigger>
      <SelectContent>{LEAD_STATUSES.map((status) => <SelectItem key={status} value={status}>{LEAD_STATUS_LABELS[status]}</SelectItem>)}</SelectContent>
    </Select>
  );
}
