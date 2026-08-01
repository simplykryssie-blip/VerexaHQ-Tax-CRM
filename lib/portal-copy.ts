import type { StatusTone } from "@/lib/status";

/**
 * Plain-language copy for the client portal. Staff see the precise
 * technical labels (lib/status.ts); clients see friendlier phrasing for the
 * exact same underlying database enum values.
 */

export type PortalStatusMeta = { label: string; tone: StatusTone };

function build(map: Record<string, PortalStatusMeta>, fallback: string) {
  return (value: string | null | undefined): PortalStatusMeta =>
    (value && map[value]) || { label: fallback, tone: "neutral" };
}

export const friendlyIntakeStatusMeta = build(
  {
    not_started: { label: "Not started yet", tone: "neutral" },
    in_progress: { label: "In progress", tone: "info" },
    submitted: { label: "Submitted — waiting on your tax office", tone: "info" },
    changes_requested: { label: "We need more from you", tone: "warning" },
    resubmitted: { label: "Resubmitted — waiting on your tax office", tone: "info" },
    under_review: { label: "Your tax office is reviewing this", tone: "info" },
    approved: { label: "Approved", tone: "success" },
    rejected: { label: "Needs your attention", tone: "danger" },
    archived: { label: "Archived", tone: "neutral" },
  },
  "Not started yet",
);

export function friendlyIntakeStatusLabel(value: string | null | undefined) {
  return friendlyIntakeStatusMeta(value).label;
}

export const friendlyDocumentItemStatusMeta = build(
  {
    requested: { label: "Not uploaded yet", tone: "warning" },
    uploaded: { label: "Uploaded — awaiting review", tone: "info" },
    under_review: { label: "Under review", tone: "info" },
    accepted: { label: "Accepted", tone: "success" },
    rejected: { label: "Needs to be replaced", tone: "danger" },
    waived: { label: "Not needed", tone: "neutral" },
    not_applicable: { label: "Not applicable", tone: "neutral" },
  },
  "Not uploaded yet",
);

export const friendlyDocumentRequestStatusMeta = build(
  {
    draft: { label: "Being prepared", tone: "neutral" },
    sent: { label: "Waiting on you", tone: "warning" },
    viewed: { label: "Waiting on you", tone: "warning" },
    in_progress: { label: "In progress", tone: "info" },
    partially_complete: { label: "Almost there", tone: "info" },
    completed: { label: "Complete", tone: "success" },
    cancelled: { label: "Cancelled", tone: "neutral" },
    expired: { label: "Expired", tone: "danger" },
  },
  "Waiting on you",
);

/**
 * Client-facing engagement status copy (Part 7). Internal workflow-stage
 * names (e.g. "preparer_review" vs "reviewer_review") are collapsed into
 * plain-language messages a taxpayer can act on.
 */
export const friendlyEngagementStatusMeta = build(
  {
    draft: { label: "Getting started", tone: "neutral" },
    awaiting_client: { label: "We are waiting for your information", tone: "warning" },
    intake_in_progress: { label: "We are waiting for your information", tone: "warning" },
    documents_requested: { label: "We need documents from you", tone: "warning" },
    ready_for_preparation: { label: "Your return is queued for preparation", tone: "info" },
    in_preparation: { label: "Your return is being prepared", tone: "info" },
    preparer_review: { label: "Your return is being prepared", tone: "info" },
    reviewer_review: { label: "Your return is under review", tone: "info" },
    awaiting_signature: { label: "Your signature is needed", tone: "warning" },
    ready_to_file: { label: "Your return is ready to file", tone: "success" },
    filed: { label: "Your return was filed", tone: "success" },
    accepted: { label: "Your return was accepted", tone: "success" },
    rejected: { label: "We need you to correct or provide more information", tone: "danger" },
    extended: { label: "An extension is in effect", tone: "warning" },
    completed: { label: "Your engagement is complete", tone: "success" },
    on_hold: { label: "Your engagement is on hold", tone: "neutral" },
    cancelled: { label: "This engagement was cancelled", tone: "neutral" },
    archived: { label: "This engagement is archived", tone: "neutral" },
  },
  "In progress",
);

export function friendlyEngagementNextAction(status: string | null | undefined): string | null {
  switch (status) {
    case "awaiting_client":
    case "intake_in_progress":
      return "Complete your tax intake.";
    case "documents_requested":
      return "Upload the requested documents.";
    case "awaiting_signature":
      return "Provide your signature or e-file authorization.";
    case "rejected":
      return "Review the notes from your tax office and respond.";
    default:
      return null;
  }
}
