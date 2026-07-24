"use client";

import { useTransition } from "react";
import { PlayCircle, CheckCircle2, ShieldCheck, FolderPlus, Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/toast";
import {
  approveAndLockAction,
  beginReviewAction,
  completeReviewAction,
  evaluateComplianceAction,
  generateDocumentRequestAction,
  reopenIntakeAction,
  validateIntakeAction,
} from "@/lib/actions/intakes";
import type { IntakeSubmissionStatus } from "@/lib/types";

export function IntakeActionsBar({
  submissionId,
  status,
  canReview,
  canStaff,
}: {
  submissionId: string;
  status: IntakeSubmissionStatus;
  canReview: boolean;
  canStaff: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  const run = (label: string, action: () => Promise<{ error?: string } | void>) => {
    startTransition(async () => {
      const result = await action();
      if (result?.error) toast.error(result.error);
      else toast.success(label);
    });
  };

  const canBegin = canReview && ["submitted", "resubmitted"].includes(status);
  const canComplete = canReview && status === "under_review";
  const canApprove = canReview && !["approved", "archived"].includes(status);
  const canReopen = canReview && ["approved", "rejected", "archived"].includes(status);

  return (
    <div className="space-y-2">
      {canBegin && (
        <Button
          size="sm"
          variant="secondary"
          className="w-full justify-start"
          disabled={isPending}
          onClick={() => run("Review started.", () => beginReviewAction(submissionId))}
        >
          <PlayCircle className="size-4" /> Begin review
        </Button>
      )}

      {canStaff && (
        <Button
          size="sm"
          variant="secondary"
          className="w-full justify-start"
          disabled={isPending}
          onClick={() => run("Validation complete.", () => validateIntakeAction(submissionId))}
        >
          <ShieldCheck className="size-4" /> Validate intake
        </Button>
      )}

      {canReview && (
        <Button
          size="sm"
          variant="secondary"
          className="w-full justify-start"
          disabled={isPending}
          onClick={() => run("Compliance evaluated.", () => evaluateComplianceAction(submissionId))}
        >
          <ShieldCheck className="size-4" /> Evaluate compliance
        </Button>
      )}

      {canStaff && (
        <ConfirmDialog
          title="Generate document request"
          description="This creates a document request for the client based on this template's document rules and sends it immediately."
          confirmLabel="Generate & send"
          onConfirm={() =>
            generateDocumentRequestAction(submissionId, true).then((res) => {
              if (!res?.error) toast.success("Document request generated.");
              return res;
            })
          }
          trigger={
            <Button size="sm" variant="secondary" className="w-full justify-start">
              <FolderPlus className="size-4" /> Generate document request
            </Button>
          }
        />
      )}

      {canComplete && (
        <ConfirmDialog
          title="Complete intake review"
          description="This finalizes the review pass. Make sure all sections have a result before continuing."
          confirmLabel="Complete review"
          onConfirm={() =>
            completeReviewAction(submissionId).then((res) => {
              if (!res?.error) toast.success("Review completed.");
              return res;
            })
          }
          trigger={
            <Button size="sm" className="w-full justify-start">
              <CheckCircle2 className="size-4" /> Complete review
            </Button>
          }
        />
      )}

      {canApprove && (
        <ConfirmDialog
          title="Approve & lock intake"
          description="This approves the intake and locks it from further edits. This action should only be taken once review is complete."
          confirmLabel="Approve & lock"
          destructive
          onConfirm={() =>
            approveAndLockAction(submissionId).then((res) => {
              if (!res?.error) toast.success("Intake approved and locked.");
              return res;
            })
          }
          trigger={
            <Button size="sm" variant="danger" className="w-full justify-start">
              <Lock className="size-4" /> Approve &amp; lock
            </Button>
          }
        />
      )}

      {canReopen && (
        <ConfirmDialog
          title="Reopen intake"
          description="This unlocks the intake for further changes. A reason is required and will be recorded in the submission history."
          confirmLabel="Reopen intake"
          destructive
          requireReason
          reasonLabel="Reason for reopening"
          onConfirm={(reason) =>
            reopenIntakeAction({ submissionId, reason: reason ?? "" }).then((res) => {
              if (!res?.error) toast.success("Intake reopened.");
              return res;
            })
          }
          trigger={
            <Button size="sm" variant="secondary" className="w-full justify-start">
              <RotateCcw className="size-4" /> Reopen intake
            </Button>
          }
        />
      )}
    </div>
  );
}
