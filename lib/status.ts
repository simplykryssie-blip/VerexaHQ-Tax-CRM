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

export const intakeAnswerStatusMeta = build({
  draft: { label: "Draft", tone: "neutral" },
  final: { label: "Final", tone: "success" },
  needs_clarification: { label: "Needs clarification", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
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

export const engagementStatusMeta = build({
  draft: { label: "Draft", tone: "neutral" },
  awaiting_client: { label: "Awaiting client", tone: "warning" },
  intake_in_progress: { label: "Intake in progress", tone: "info" },
  documents_requested: { label: "Documents requested", tone: "warning" },
  ready_for_preparation: { label: "Ready for preparation", tone: "info" },
  in_preparation: { label: "In preparation", tone: "info" },
  preparer_review: { label: "Preparer review", tone: "info" },
  reviewer_review: { label: "Reviewer review", tone: "warning" },
  awaiting_signature: { label: "Awaiting signature", tone: "warning" },
  ready_to_file: { label: "Ready to file", tone: "success" },
  filed: { label: "Filed", tone: "success" },
  accepted: { label: "Accepted", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  extended: { label: "Extended", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  on_hold: { label: "On hold", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  archived: { label: "Archived", tone: "neutral" },
});

export const engagementStatusDescriptions: Record<string, string> = {
  draft: "Not yet started.",
  awaiting_client: "Waiting on information from the client.",
  intake_in_progress: "Client is completing their tax intake.",
  documents_requested: "Waiting on requested documents.",
  ready_for_preparation: "Intake and documents are complete; ready to prepare.",
  in_preparation: "The preparer is actively working on this return.",
  preparer_review: "Preparer is doing a self-review pass.",
  reviewer_review: "A reviewer is checking this return.",
  awaiting_signature: "Waiting on e-file authorization or signature.",
  ready_to_file: "Approved and ready to file.",
  filed: "Filed with the taxing authority.",
  accepted: "Accepted by the taxing authority.",
  rejected: "Rejected by the taxing authority; needs correction.",
  extended: "An extension is in effect.",
  completed: "Engagement is finished.",
  on_hold: "Temporarily paused.",
  cancelled: "Cancelled.",
  archived: "Archived and read-only.",
};

export const engagementTypeLabels: Record<string, string> = {
  individual: "Individual",
  business: "Business",
  nonprofit: "Nonprofit",
  amended_return: "Amended Return",
  extension_only: "Extension Only",
  tax_planning: "Tax Planning",
  notice_resolution: "Notice Resolution",
  other: "Other",
};

export const returnTypeLabels: Record<string, string> = {
  "1040": "Form 1040 (Individual)",
  "1040-X": "Form 1040-X (Amended Individual)",
  "1065": "Form 1065 (Partnership)",
  "1120": "Form 1120 (C Corporation)",
  "1120-S": "Form 1120-S (S Corporation)",
  "1041": "Form 1041 (Estates & Trusts)",
  "706": "Form 706 (Estate Tax)",
  "709": "Form 709 (Gift Tax)",
  "990": "Form 990 (Nonprofit)",
  "941": "Form 941 (Employer Quarterly)",
  "940": "Form 940 (Federal Unemployment)",
  state_individual: "State Individual",
  state_business: "State Business",
  local: "Local",
  other: "Other",
};

export const engagementPriorityMeta = build({
  low: { label: "Low", tone: "neutral" },
  normal: { label: "Normal", tone: "info" },
  high: { label: "High", tone: "warning" },
  urgent: { label: "Urgent", tone: "danger" },
});

export const engagementEfileStatusMeta = build({
  not_started: { label: "Not started", tone: "neutral" },
  not_applicable: { label: "Not applicable", tone: "neutral" },
  awaiting_authorization: { label: "Awaiting authorization", tone: "warning" },
  ready: { label: "Ready", tone: "info" },
  transmitted: { label: "Transmitted", tone: "info" },
  accepted: { label: "Accepted", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
  corrected: { label: "Corrected", tone: "info" },
  paper_filed: { label: "Paper filed", tone: "info" },
});

export const engagementPaymentStatusMeta = build({
  not_required: { label: "Not required", tone: "neutral" },
  unpaid: { label: "Unpaid", tone: "warning" },
  partially_paid: { label: "Partially paid", tone: "warning" },
  paid: { label: "Paid", tone: "success" },
  payment_plan: { label: "Payment plan", tone: "info" },
  refund_transfer: { label: "Refund transfer", tone: "info" },
  waived: { label: "Waived", tone: "neutral" },
});

export const dueDateStateLabels: Record<string, string> = {
  overdue: "Overdue",
  due_soon_7: "Due within 7 days",
  due_soon_30: "Due within 30 days",
  no_due_date: "No due date",
};

/**
 * Guided Tax Organizer (Part 28) — shared display metadata. The organizer
 * reuses intake_submissions/intake_submission_status as its assignment
 * status (see intakeSubmissionStatusMeta above), so this section only adds
 * the concepts genuinely new to the organizer: question type labels,
 * template status, and rollover state.
 */
export const questionTypeLabels: Record<string, string> = {
  section: "Section",
  heading: "Heading",
  paragraph: "Paragraph",
  text: "Short text",
  textarea: "Long text",
  number: "Whole number",
  currency: "Currency",
  date: "Date",
  year: "Year",
  email: "Email",
  phone: "Phone",
  address: "Address",
  yes_no: "Yes / No",
  single_choice: "Single select",
  multiple_choice: "Multi-select",
  dropdown: "Dropdown",
  file_upload: "Document upload",
  signature: "Signature acknowledgment",
  calculation: "Calculation",
  repeatable_group: "Repeating group",
  staff_only: "Staff-only",
  divider: "Divider",
  percentage: "Percentage",
  acknowledgment: "Acknowledgment",
};

export const templateStatusMeta = build({
  draft: { label: "Draft", tone: "neutral" },
  published: { label: "Published", tone: "success" },
  archived: { label: "Archived", tone: "neutral" },
});

export const rolloverStateLabels: Record<string, string> = {
  rolled_forward: "Rolled forward from last year",
  needs_confirmation: "Needs your confirmation",
  confirmed: "Confirmed",
};
export function engagementStatusLabel(status: string): string {
  return engagementStatusMeta(status).label;
}
