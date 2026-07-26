import type { Database } from "@/lib/supabase/types";

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

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
export type TaxEngagement = Tables<"tax_engagements">;
export type DocumentCategory = Tables<"document_categories">;
export type DocumentRow = Tables<"documents">;
export type DocumentReview = Tables<"document_reviews">;
export type Conversation = Tables<"conversations">;
export type Message = Tables<"messages">;
export type FormTemplate = Tables<"form_templates">;
export type TemplateVersion = Tables<"template_versions">;
export type EngagementActivity = Tables<"engagement_status_history">;
export type EngagementNote = Tables<"engagement_notes">;
export type Template = Tables<"templates">;
export type HouseholdMember = Tables<"household_members">;
export type Notification = Tables<"notifications">;

export type MembershipRole = Enums<"membership_role">;
export type MembershipStatus = Enums<"membership_status">;
export type ClientTypeEnum = Enums<"client_type">;
export type IntakeSubmissionStatus = Enums<"intake_submission_status">;
export type IntakeAnswerStatus = Enums<"intake_answer_status">;
export type ReviewResult = Enums<"review_result">;
export type DocumentRequestStatus = Enums<"document_request_status">;
export type DocumentRequestItemStatus = Enums<"document_request_item_status">;
export type IntakeRevisionReason = Enums<"intake_revision_reason">;
export type DocumentStatus = Enums<"document_status">;
export type DocumentReviewStatus = Enums<"document_review_status">;
export type IntakeEntityType = Enums<"intake_entity_type">;
export type EngagementStatus = Enums<"engagement_status">;
export type EngagementType = Enums<"engagement_type">;
export type TaxReturnType = Enums<"tax_return_type">;
export type EngagementPriority = Enums<"engagement_priority">;
export type EngagementEfileStatus = Enums<"engagement_efile_status">;
export type EngagementPaymentStatus = Enums<"engagement_payment_status">;
export type FormComponentType = Enums<"form_component_type">;
export type ConditionOperator = Enums<"condition_operator">;
export type TemplateStatus = Enums<"template_status">;
export type TemplateVisibility = Enums<"template_visibility">;
export type TemplateKind = Enums<"template_kind">;

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
