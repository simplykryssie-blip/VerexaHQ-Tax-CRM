"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/toast";
import { submitPortalIntakeAction } from "@/lib/actions/portal-intake";
import { friendlyIntakeStatusLabel } from "@/lib/portal-copy";
import type { IntakeSubmission, IntakeValidationResult } from "@/lib/types";

export function ReviewSubmitTab({
  submission,
  validationResults,
  editable,
}: {
  submission: IntakeSubmission;
  validationResults: IntakeValidationResult[];
  editable: boolean;
}) {
  if (!editable) {
    return (
      <Card>
        <CardBody className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent-600" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {friendlyIntakeStatusLabel(submission.status)}
            </p>
            <p className="mt-1 text-sm text-muted">
              Your intake has been submitted. Your tax office will review it and reach out if
              anything else is needed.
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Before you submit</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          {validationResults.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-accent-700">
              <CheckCircle2 className="size-4" /> Everything looks complete.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted">We still need information from you:</p>
              <ul className="space-y-2">
                {validationResults.map((result) => (
                  <li key={result.id} className="flex items-start gap-2 text-sm text-amber-800">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    {result.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        title="Submit your tax intake"
        description="Once submitted, your tax office will begin reviewing your information. You can still be asked for clarifications after submitting."
        confirmLabel="Submit intake"
        onConfirm={async () => {
          const result = await submitPortalIntakeAction(submission.id);
          if (!result?.error) toast.success("Your intake has been submitted.");
          return result;
        }}
        trigger={<Button className="w-full sm:w-auto">Submit intake</Button>}
      />
    </div>
  );
}
