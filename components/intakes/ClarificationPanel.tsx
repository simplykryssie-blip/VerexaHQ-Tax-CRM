"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { requestClarificationAction, resolveClarificationAction } from "@/lib/actions/intakes";
import { toast } from "@/lib/toast";
import { formatRelativeTime } from "@/lib/utils";
import { inputClassName } from "@/components/ui/FormField";
import type { FormField as FormFieldRow, IntakeReviewComment } from "@/lib/types";

type FieldOption = { id: string; label: string };

export function ClarificationPanel({
  submissionId,
  comments,
  fieldOptions,
  canRequest,
}: {
  submissionId: string;
  comments: (IntakeReviewComment & { field: FormFieldRow | null })[];
  fieldOptions: FieldOption[];
  canRequest: boolean;
}) {
  const [fieldId, setFieldId] = useState(fieldOptions[0]?.id ?? "");
  const [comment, setComment] = useState("");
  const [clientVisible, setClientVisible] = useState(true);
  const [isPending, startTransition] = useTransition();

  const unresolved = comments.filter((c) => !c.resolved_at);
  const resolved = comments.filter((c) => c.resolved_at);

  const submit = () => {
    if (!fieldId || comment.trim().length < 3) {
      toast.error("Choose a field and enter a clarification message.");
      return;
    }
    startTransition(async () => {
      const res = await requestClarificationAction({ submissionId, fieldId, comment, clientVisible });
      if (res?.error) toast.error(res.error);
      else {
        toast.success("Clarification requested.");
        setComment("");
      }
    });
  };

  const resolve = (commentId: string) => {
    startTransition(async () => {
      const res = await resolveClarificationAction({ commentId }, submissionId);
      if (res?.error) toast.error(res.error);
      else toast.success("Clarification resolved.");
    });
  };

  return (
    <div className="space-y-4">
      {unresolved.length === 0 && resolved.length === 0 && (
        <p className="text-sm text-muted">No clarifications requested yet.</p>
      )}

      {unresolved.length > 0 && (
        <div className="space-y-2">
          {unresolved.map((c) => (
            <div key={c.id} className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-foreground">{c.field?.label || "General"}</p>
                <StatusBadge label={c.is_client_visible ? "Client-visible" : "Internal"} tone={c.is_client_visible ? "info" : "neutral"} />
              </div>
              <p className="mt-1 text-sm text-foreground">{c.comment}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-muted">{formatRelativeTime(c.created_at)}</span>
                <button
                  disabled={isPending}
                  onClick={() => resolve(c.id)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent-700 hover:underline disabled:opacity-50"
                >
                  <CheckCircle2 className="size-3.5" /> Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {resolved.length > 0 && (
        <details className="text-xs text-muted">
          <summary className="cursor-pointer select-none">Resolved ({resolved.length})</summary>
          <div className="mt-2 space-y-2">
            {resolved.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-3">
                <p className="font-medium text-foreground">{c.field?.label || "General"}</p>
                <p className="mt-1">{c.comment}</p>
                <p className="mt-1 text-accent-700">Resolved {formatRelativeTime(c.resolved_at)}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {canRequest && fieldOptions.length > 0 && (
        <div className="space-y-2 border-t border-border pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Request clarification</p>
          <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} className={inputClassName}>
            {fieldOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="What do you need the client to clarify?"
            className={inputClassName}
          />
          <label className="flex items-center gap-1.5 text-xs text-foreground">
            <input
              type="checkbox"
              checked={clientVisible}
              onChange={(e) => setClientVisible(e.target.checked)}
              className="size-3.5 rounded border-border text-accent-600 focus:ring-accent-500"
            />
            Visible to client
          </label>
          <Button size="sm" onClick={submit} loading={isPending} className="w-full">
            Send clarification request
          </Button>
        </div>
      )}
    </div>
  );
}
