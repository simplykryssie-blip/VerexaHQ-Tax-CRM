export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

export type StatusMeta = { label: string; tone: StatusTone };

function build(map: Record<string, StatusMeta>) {
  return (value: string | null | undefined): StatusMeta =>
    (value && map[value]) || { label: value ? value.replace(/_/g, " ") : "—", tone: "neutral" };
}

export const intakeSubmissionStatusMeta = build({
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  submitted: { label: "Submitted", tone: "info" },
  changes_requested: { label: "Changes requested", tone: "warning" },
  resubmitted: { label: "Resubmitted", tone: "info" },
  under_review: { label: "Under review", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  archived: { label: "Archived", tone: "neutral" },
});

export const reviewResultMeta = build({
  pending: { label: "Not reviewed", tone: "neutral" },
  pass: { label: "Passed", tone: "success" },
  fail: { label: "Failed", tone: "danger" },
  needs_clarification: { label: "Needs clarification", tone: "warning" },
  not_applicable: { label: "Not applicable", tone: "neutral" },
});

export const documentRequestStatusMeta = build({
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Sent", tone: "info" },
  viewed: { label: "Viewed", tone: "info" },
  in_progress: { label: "In progress", tone: "info" },
  partially_complete: { label: "Partially complete", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "danger" },
});

export const documentRequestItemStatusMeta = build({
  requested: { label: "Requested", tone: "neutral" },
  uploaded: { label: "Uploaded", tone: "info" },
  under_review: { label: "Under review", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  waived: { label: "Waived", tone: "neutral" },
  not_applicable: { label: "Not applicable", tone: "neutral" },
});

export const clientStatusMeta = build({
  lead: { label: "Lead", tone: "info" },
  prospect: { label: "Prospect", tone: "info" },
  active: { label: "Active", tone: "success" },
  inactive: { label: "Inactive", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
});

export const membershipStatusMeta = build({
  invited: { label: "Invited", tone: "warning" },
  active: { label: "Active", tone: "success" },
  suspended: { label: "Suspended", tone: "danger" },
  removed: { label: "Removed", tone: "neutral" },
});

export const validationSeverityMeta = build({
  error: { label: "Error", tone: "danger" },
  warning: { label: "Warning", tone: "warning" },
  info: { label: "Info", tone: "info" },
});

export const membershipRoleLabels: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  ero: "ERO",
  preparer: "Preparer",
  reviewer: "Reviewer",
  intake_specialist: "Intake Specialist",
  document_specialist: "Document Specialist",
  billing: "Billing",
  seasonal_staff: "Seasonal Staff",
  auditor: "Auditor",
  client: "Client",
};
