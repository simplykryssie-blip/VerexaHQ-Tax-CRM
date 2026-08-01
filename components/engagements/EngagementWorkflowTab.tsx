"use client";

import { useState, useTransition } from "react";
import { Card, CardBody, CardHeader } from "@/components/ui/LegacyCard";
import { Button } from "@/components/ui/LegacyButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { toast } from "@/lib/toast";
import { engagementStatusMeta } from "@/lib/status";
import {
  engagementPriorityOptions,
  engagementEfileStatusOptions,
} from "@/lib/validation/engagements";
import {
  changeStatusAction,
  changePriorityAction,
  changeDueDatesAction,
  assignPreparerAction,
  assignReviewerAction,
  assignResponsibleStaffAction,
  markExtensionRequestedAction,
  markExtensionFiledAction,
  updateEfileStatusAction,
  submitForReviewAction,
  markReviewCompleteAction,
  markReadyToFileAction,
  markFiledAction,
  markAcceptedAction,
  markRejectedAction,
  completeEngagementAction,
  placeOnHoldAction,
  cancelEngagementAction,
  archiveEngagementAction,
} from "@/lib/actions/engagements";
import { checkStatusTransition, isActiveStatus } from "@/lib/engagements/transitions";
import type { EngagementStatus, EngagementPriority, EngagementEfileStatus } from "@/lib/types";
import type { TaxEngagement } from "@/lib/types";
import type { UserSummary } from "@/lib/data/users";

export function EngagementWorkflowTab({
  engagement,
  staff,
  canManage,
  canArchive,
  canAssignReviewer,
}: {
  engagement: TaxEngagement;
  staff: UserSummary[];
  canManage: boolean;
  canArchive: boolean;
  canAssignReviewer: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [preparerId, setPreparerId] = useState(engagement.primary_preparer_user_id ?? "");
  const [reviewerId, setReviewerId] = useState(engagement.reviewer_user_id ?? "");
  const [responsibleId, setResponsibleId] = useState(engagement.responsible_staff_user_id ?? "");
  const [internalDueDate, setInternalDueDate] = useState(engagement.internal_due_date ?? "");

  const run = (label: string, action: () => Promise<{ error?: string } | void>) => {
    startTransition(async () => {
      const result = await action();
      if (result?.error) toast.error(result.error);
      else toast.success(label);
    });
  };

  const status = engagement.status as EngagementStatus;
  const nextActions: { label: string; run: () => void }[] = [];

  if (checkStatusTransition(status, "intake_in_progress").allowed && status === "draft") {
    nextActions.push({ label: "Start intake", run: () => run("Intake started.", () => changeStatusAction({ engagementId: engagement.id, status: "intake_in_progress" })) });
  }
  if (checkStatusTransition(status, "documents_requested").allowed) {
    nextActions.push({ label: "Mark documents requested", run: () => run("Marked as documents requested.", () => changeStatusAction({ engagementId: engagement.id, status: "documents_requested" })) });
  }
  if (checkStatusTransition(status, "ready_for_preparation").allowed) {
    nextActions.push({ label: "Mark ready for preparation", run: () => run("Marked ready for preparation.", () => changeStatusAction({ engagementId: engagement.id, status: "ready_for_preparation" })) });
  }
  if (checkStatusTransition(status, "in_preparation").allowed) {
    nextActions.push({ label: "Start preparation", run: () => run("Preparation started.", () => changeStatusAction({ engagementId: engagement.id, status: "in_preparation" })) });
  }
  if (["in_preparation", "preparer_review"].includes(status)) {
    nextActions.push({ label: "Submit for review", run: () => run("Submitted for review.", () => submitForReviewAction(engagement.id)) });
  }
  if (status === "reviewer_review") {
    nextActions.push({ label: "Complete review", run: () => run("Review completed.", () => markReviewCompleteAction(engagement.id)) });
  }
  if (checkStatusTransition(status, "ready_to_file").allowed) {
    nextActions.push({ label: "Mark ready to file", run: () => run("Marked ready to file.", () => markReadyToFileAction(engagement.id)) });
  }
  if (checkStatusTransition(status, "filed").allowed) {
    nextActions.push({ label: "Mark filed", run: () => run("Marked filed.", () => markFiledAction(engagement.id)) });
  }
  if (status === "filed") {
    nextActions.push({ label: "Mark accepted", run: () => run("Marked accepted.", () => markAcceptedAction(engagement.id)) });
    nextActions.push({ label: "Mark rejected", run: () => run("Marked rejected.", () => markRejectedAction(engagement.id)) });
  }
  if (status === "rejected") {
    nextActions.push({ label: "Return to preparation", run: () => run("Returned to preparation.", () => changeStatusAction({ engagementId: engagement.id, status: "in_preparation" })) });
  }
  if (checkStatusTransition(status, "completed").allowed) {
    nextActions.push({ label: "Complete engagement", run: () => run("Engagement completed.", () => completeEngagementAction(engagement.id)) });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Status</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-muted">
            Current status: <span className="font-medium text-foreground">{engagementStatusMeta(status).label}</span>
          </p>

          {canManage && nextActions.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {nextActions.map((action) => (
                <Button key={action.label} size="sm" variant="secondary" disabled={isPending} onClick={action.run}>
                  {action.label}
                </Button>
              ))}
            </div>
          )}

          {canManage && (
            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              {isActiveStatus(status) && (
                <ConfirmDialog
                  title="Place on hold"
                  description="This pauses the engagement. A reason is required."
                  confirmLabel="Place on hold"
                  requireReason
                  onConfirm={(reason) => placeOnHoldAction(engagement.id, reason ?? "")}
                  trigger={
                    <Button size="sm" variant="secondary">
                      Place on hold
                    </Button>
                  }
                />
              )}
              {status !== "cancelled" && status !== "archived" && (
                <ConfirmDialog
                  title="Cancel engagement"
                  description="This cancels the engagement. It cannot be marked filed until reopened. A reason is required."
                  confirmLabel="Cancel engagement"
                  destructive
                  requireReason
                  onConfirm={(reason) => cancelEngagementAction(engagement.id, reason ?? "")}
                  trigger={
                    <Button size="sm" variant="danger">
                      Cancel
                    </Button>
                  }
                />
              )}
              {status === "cancelled" && (
                <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run("Reopened.", () => changeStatusAction({ engagementId: engagement.id, status: "draft" }))}>
                  Reopen
                </Button>
              )}
              {canArchive && status === "completed" && (
                <Button size="sm" variant="secondary" disabled={isPending} onClick={() => run("Archived.", () => archiveEngagementAction(engagement.id))}>
                  Archive
                </Button>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {canManage && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Assignment</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Preparer" htmlFor="preparer">
              <select
                id="preparer"
                className={inputClassName}
                value={preparerId}
                onChange={(e) => {
                  setPreparerId(e.target.value);
                  run("Preparer updated.", () => assignPreparerAction(engagement.id, e.target.value || null));
                }}
              >
                <option value="">Unassigned</option>
                {staff.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Reviewer" htmlFor="reviewer">
              <select
                id="reviewer"
                className={inputClassName}
                value={reviewerId}
                disabled={!canAssignReviewer}
                onChange={(e) => {
                  setReviewerId(e.target.value);
                  run("Reviewer updated.", () => assignReviewerAction(engagement.id, e.target.value || null));
                }}
              >
                <option value="">Unassigned</option>
                {staff.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
              {!canAssignReviewer && <p className="mt-1 text-xs text-muted">Reviewer assignment is controlled by the ERO or workspace administrator.</p>}
            </FormField>
            <FormField label="Responsible staff" htmlFor="responsible">
              <select
                id="responsible"
                className={inputClassName}
                value={responsibleId}
                onChange={(e) => {
                  setResponsibleId(e.target.value);
                  run("Responsible staff updated.", () => assignResponsibleStaffAction(engagement.id, e.target.value || null));
                }}
              >
                <option value="">Unassigned</option>
                {staff.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name}
                  </option>
                ))}
              </select>
            </FormField>
          </CardBody>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Priority &amp; internal target</h2>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Priority" htmlFor="priority">
              <select
                id="priority"
                className={inputClassName}
                defaultValue={engagement.priority}
                onChange={(e) => run("Priority updated.", () => changePriorityAction(engagement.id, e.target.value as EngagementPriority))}
              >
                {engagementPriorityOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Internal due date" htmlFor="internalDueDate">
              <input
                id="internalDueDate"
                type="date"
                className={inputClassName}
                value={internalDueDate ?? ""}
                onChange={(e) => setInternalDueDate(e.target.value)}
                onBlur={() => run("Internal due date updated.", () => changeDueDatesAction({ engagementId: engagement.id, internalDueDate }))}
              />
            </FormField>
            <p className="self-end pb-2 text-xs text-muted">Statutory filing and extension dates are calculated from the return and jurisdictions on the Edit screen.</p>
          </CardBody>
        </Card>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Extension &amp; e-file</h2>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending || engagement.extension_requested}
                onClick={() => run("Extension marked as requested.", () => markExtensionRequestedAction(engagement.id))}
              >
                Mark extension requested
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={isPending || engagement.extension_filed}
                onClick={() => run("Extension marked as filed.", () => markExtensionFiledAction(engagement.id))}
              >
                Mark extension filed
              </Button>
            </div>
            <FormField label="E-file status" htmlFor="efileStatus">
              <select
                id="efileStatus"
                className={inputClassName}
                defaultValue={engagement.efile_status}
                onChange={(e) => run("E-file status updated.", () => updateEfileStatusAction(engagement.id, e.target.value as EngagementEfileStatus))}
              >
                {engagementEfileStatusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </FormField>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
