import type { EngagementStatus } from "@/lib/types";

const ACTIVE_STATUSES: EngagementStatus[] = [
  "draft",
  "awaiting_client",
  "intake_in_progress",
  "documents_requested",
  "ready_for_preparation",
  "in_preparation",
  "preparer_review",
  "reviewer_review",
  "awaiting_signature",
  "ready_to_file",
];

/**
 * Centralized status transition map (Part 10). Every legal move from one
 * engagement status to another is listed here; the UI and server action
 * both consult this instead of allowing a free jump between any two
 * statuses. `on_hold`/`extended` are reachable from any active status and
 * return to whichever status the engagement was in before (recorded in
 * activity metadata by the caller), so they're modeled as reachable from
 * every active status rather than listed exhaustively below.
 */
const TRANSITIONS: Record<EngagementStatus, EngagementStatus[]> = {
  draft: ["awaiting_client", "intake_in_progress", "cancelled"],
  awaiting_client: ["intake_in_progress", "cancelled"],
  intake_in_progress: ["documents_requested", "cancelled"],
  documents_requested: ["ready_for_preparation", "cancelled"],
  ready_for_preparation: ["in_preparation", "cancelled"],
  in_preparation: ["preparer_review", "cancelled"],
  preparer_review: ["reviewer_review", "in_preparation", "cancelled"],
  reviewer_review: ["awaiting_signature", "in_preparation", "cancelled"],
  awaiting_signature: ["ready_to_file", "cancelled"],
  ready_to_file: ["filed", "cancelled"],
  filed: ["accepted", "rejected"],
  accepted: ["completed"],
  rejected: ["in_preparation"],
  extended: ["ready_for_preparation", "in_preparation", "cancelled"],
  on_hold: [], // resumes to a prior status via override, not a fixed next step
  completed: ["archived"],
  cancelled: ["draft"], // reopen
  archived: [], // read-only unless restored by an authorized role (override)

  // Legacy enum values kept for backward compatibility with the original
  // scaffold; not offered as destinations by the new UI, but a defined
  // (empty) entry keeps this map exhaustive over the full enum.
  intake_not_started: ["intake_in_progress"],
  missing_documents: ["ready_for_preparation"],
  preparation_in_progress: ["preparer_review"],
  internal_review: ["awaiting_signature"],
  awaiting_payment: ["ready_to_file"],
  ready_for_ero: ["filed"],
  sent_to_tax_software: ["filed"],
  transmitted_externally: ["filed"],
  acknowledgement_pending: ["accepted", "rejected"],
  correction_in_progress: ["in_preparation"],
};

export function isActiveStatus(status: EngagementStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export type TransitionCheck = { allowed: true } | { allowed: false; reason: string };

/**
 * Validates a status transition against the map above, plus the "any
 * active status -> on_hold" and "active statuses -> extended" rules that
 * apply universally rather than per-source-status.
 */
export function checkStatusTransition(
  from: EngagementStatus,
  to: EngagementStatus,
  options: { override?: boolean } = {},
): TransitionCheck {
  if (from === to) {
    return { allowed: false, reason: "Engagement is already in that status." };
  }

  if (options.override) {
    return { allowed: true };
  }

  if (to === "on_hold" && isActiveStatus(from)) {
    return { allowed: true };
  }

  if (from === "on_hold") {
    // on_hold can resume to any active status; the specific "prior status"
    // policy is enforced by the caller passing the remembered status.
    return { allowed: true };
  }

  if (to === "extended" && isActiveStatus(from)) {
    return { allowed: true };
  }

  const allowedNext = TRANSITIONS[from] ?? [];
  if (allowedNext.includes(to)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Cannot move from "${from.replace(/_/g, " ")}" to "${to.replace(/_/g, " ")}" without an override.`,
  };
}

export type EngagementForTransition = {
  status: EngagementStatus;
  primary_preparer_user_id: string | null;
  reviewer_user_id: string | null;
};

/**
 * Part 9 business-rule prerequisites that depend on more than the status
 * enum alone (role assignment prerequisites). Money-field and
 * extension-implication rules are enforced by database CHECK constraints;
 * these are the ones that need a friendlier, checked-before-the-fact
 * message.
 */
export function checkTransitionPrerequisites(
  engagement: EngagementForTransition,
  to: EngagementStatus,
): TransitionCheck {
  if (to === "in_preparation" && !engagement.primary_preparer_user_id) {
    return { allowed: false, reason: "Assign a preparer before moving this engagement into preparation." };
  }
  if (to === "reviewer_review" && !engagement.reviewer_user_id) {
    return { allowed: false, reason: "Assign a reviewer before sending this engagement to review." };
  }
  if (to === "filed" && engagement.status === "cancelled") {
    return { allowed: false, reason: "Reopen this cancelled engagement before marking it filed." };
  }
  return { allowed: true };
}

export type EngagementStatusTimestamps = {
  started_at?: string;
  submitted_for_review_at?: string;
  reviewed_at?: string;
  filed_at?: string;
  completed_at?: string;
  archived_at?: string;
};

/**
 * Side-effect timestamps a status change should stamp (Part 9), applied
 * alongside the status update itself in the same mutation.
 */
export function timestampsForStatusChange(to: EngagementStatus): EngagementStatusTimestamps {
  const now = new Date().toISOString();
  switch (to) {
    case "in_preparation":
      return { started_at: now };
    case "preparer_review":
    case "reviewer_review":
      return { submitted_for_review_at: now };
    case "ready_to_file":
      return { reviewed_at: now };
    case "filed":
    case "accepted":
      return { filed_at: now };
    case "completed":
      return { completed_at: now };
    case "archived":
      return { archived_at: now };
    default:
      return {};
  }
}
