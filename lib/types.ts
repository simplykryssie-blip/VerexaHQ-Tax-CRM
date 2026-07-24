import type { Database } from "@/lib/supabase/types";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];

export type Workspace = Tables<"workspaces">;
export type WorkspaceMember = Tables<"workspace_members">;
export type Client = Tables<"clients">;
export type ClientContact = Tables<"client_contacts">;
export type ClientAddress = Tables<"client_addresses">;
export type IntakeSubmission = Tables<"intake_submissions">;
export type IntakeAnswer = Tables<"intake_answers">;
export type IntakeHouseholdPerson = Tables<"intake_household_people">;
export type IntakeIncomeSource = Tables<"intake_income_sources">;
export type IntakeDeductionCredit = Tables<"intake_deductions_credits">;
export type IntakeRepeatableEntity = Tables<"intake_repeatable_entities">;
export type IntakeSubmissionRevision = Tables<"intake_submission_revisions">;
export type IntakeDocumentRule = Tables<"intake_document_rules">;
export type IntakeComplianceRule = Tables<"intake_compliance_rules">;
export type IntakeValidationResult = Tables<"intake_validation_results">;
export type IntakeReviewSection = Tables<"intake_review_sections">;
export type IntakeReviewAction = Tables<"intake_review_actions">;
export type IntakeReviewComment = Tables<"intake_review_comments">;
export type DocumentRequest = Tables<"document_requests">;
export type DocumentRequestItem = Tables<"document_request_items">;
export type FormSection = Tables<"form_sections">;
export type FormField = Tables<"form_fields">;
export type UserProfile = Tables<"user_profiles">;

export type MembershipRole = Enums<"membership_role">;
export type MembershipStatus = Enums<"membership_status">;
export type ClientTypeEnum = Enums<"client_type">;
export type IntakeSubmissionStatus = Enums<"intake_submission_status">;
export type IntakeAnswerStatus = Enums<"intake_answer_status">;
export type ReviewResult = Enums<"review_result">;
export type DocumentRequestStatus = Enums<"document_request_status">;
export type DocumentRequestItemStatus = Enums<"document_request_item_status">;
export type IntakeRevisionReason = Enums<"intake_revision_reason">;

export const STAFF_ROLES: MembershipRole[] = [
  "owner",
  "admin",
  "ero",
  "preparer",
  "reviewer",
  "intake_specialist",
  "document_specialist",
  "billing",
  "seasonal_staff",
  "auditor",
];

export const REVIEW_ROLES: MembershipRole[] = [
  "owner",
  "admin",
  "ero",
  "preparer",
  "reviewer",
];

export const MANAGE_ROLES: MembershipRole[] = ["owner", "admin", "ero"];
