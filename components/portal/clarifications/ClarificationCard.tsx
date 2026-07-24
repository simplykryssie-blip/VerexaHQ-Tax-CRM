"use client";

import { useState } from "react";
import { CheckCircle2, MessageCircleQuestion } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { toast } from "@/lib/toast";
import { respondToClarificationAction } from "@/lib/actions/portal-clarifications";
import { formatDateTime } from "@/lib/utils";
import type { PortalClarification } from "@/lib/data/portal-clarifications";

export function ClarificationCard({ clarification }: { clarification: PortalClarification }) {
  const [response, setResponse] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const isResolved = Boolean(clarification.resolved_at);

  const submit = async () => {
    if (response.trim().length < 3) {
      toast.error("Please enter a response.");
      return;
    }
    setIsSubmitting(true);
    const result = await respondToClarificationAction({
      submissionId: clarification.submission_id,
      fieldId: clarification.field_id,
      comment: response,
    });
    setIsSubmitting(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Response sent to your tax office.");
    setSent(true);
  };

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <MessageCircleQuestion className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div>
              <p className="text-xs text-muted">
                {clarification.field?.label ?? "General question"}
                {clarification.submission?.tax_year ? ` · Tax year ${clarification.submission.tax_year}` : ""}
              </p>
              <p className="mt-1 text-sm text-foreground">{clarification.comment}</p>
            </div>
          </div>
          <StatusBadge
            label={isResolved ? "Resolved" : "Needs your response"}
            tone={isResolved ? "success" : "warning"}
          />
        </div>
        <p className="text-xs text-muted">Asked {formatDateTime(clarification.created_at)}</p>

        {!isResolved && !sent && (
          <div className="space-y-2 border-t border-border pt-3">
            <textarea
              value={response}
              onChange={(e) => setResponse(e.target.value)}
              rows={3}
              placeholder="Type your response…"
              className="block w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
            />
            <Button size="sm" onClick={submit} loading={isSubmitting}>
              Send response
            </Button>
          </div>
        )}

        {sent && (
          <p className="flex items-center gap-2 border-t border-border pt-3 text-sm text-accent-700">
            <CheckCircle2 className="size-4" /> Response sent — awaiting review by your tax office.
          </p>
        )}
      </CardBody>
    </Card>
  );
}
