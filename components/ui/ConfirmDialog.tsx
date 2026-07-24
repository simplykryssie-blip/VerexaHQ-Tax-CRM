"use client";

import { useRef, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";

type ConfirmDialogProps = {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  requireReason?: boolean;
  reasonLabel?: string;
  onConfirm: (reason?: string) => Promise<{ error?: string } | void>;
};

/**
 * Wraps a trigger element in a native <dialog> confirmation modal. Used for
 * consequential staff actions (approve & lock, reopen, etc.) so nothing
 * destructive fires from a single accidental click.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  requireReason = false,
  reasonLabel = "Reason",
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const open = () => {
    setError(null);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  const handleConfirm = () => {
    if (requireReason && !reason.trim()) {
      setError("A reason is required.");
      return;
    }
    startTransition(async () => {
      const result = await onConfirm(requireReason ? reason.trim() : undefined);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setReason("");
      close();
    });
  };

  return (
    <>
      <span onClick={open}>{trigger}</span>
      <dialog
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-border bg-white p-0 shadow-lg backdrop:bg-slate-900/40"
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
      >
        <div className="flex items-start gap-3 border-b border-border p-5">
          {destructive && (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertTriangle className="size-4" />
            </div>
          )}
          <div>
            <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted">{description}</p>
          </div>
        </div>

        {requireReason && (
          <div className="px-5 pt-4">
            <label className="block text-sm font-medium text-foreground">
              {reasonLabel}
              <span className="text-red-600"> *</span>
            </label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="mt-1.5 block w-full rounded-lg border border-border px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
            />
          </div>
        )}

        {error && <p className="px-5 pt-3 text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 p-5">
          <Button variant="secondary" size="sm" onClick={close} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            size="sm"
            onClick={handleConfirm}
            loading={isPending}
          >
            {confirmLabel}
          </Button>
        </div>
      </dialog>
    </>
  );
}
