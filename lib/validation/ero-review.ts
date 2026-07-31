import type { Enums } from "@/types/database";

type EroReviewStatus = Enums<"ero_review_status">;
type PayoutMethod = Enums<"payout_method">;
type PayoutStatus = Enums<"payout_status">;

export const ERO_REVIEW_STATUS_LABELS: Record<EroReviewStatus, string> = {
  not_submitted: "Not submitted",
  pending_review: "Pending ERO review",
  approved: "Approved",
  needs_revision: "Needs revision",
};

export const PAYOUT_METHOD_LABELS: Record<PayoutMethod, string> = {
  via_ero: "Via ERO",
  direct_from_bank: "Direct from bank",
};

export const PAYOUT_STATUS_LABELS: Record<PayoutStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  failed: "Failed",
};

export function eroReviewStatusLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return (ERO_REVIEW_STATUS_LABELS as Record<string, string>)[v] ?? v.replace(/_/g, " ");
}
export function payoutMethodLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return (PAYOUT_METHOD_LABELS as Record<string, string>)[v] ?? v.replace(/_/g, " ");
}
export function payoutStatusLabel(v: string | null | undefined): string {
  if (!v) return "—";
  return (PAYOUT_STATUS_LABELS as Record<string, string>)[v] ?? v.replace(/_/g, " ");
}
