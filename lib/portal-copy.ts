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
