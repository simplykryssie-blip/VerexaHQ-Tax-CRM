-- Tax Engagement Management, part 1: extend the existing tax_engagements
-- table and its enums rather than creating a parallel schema. This project
-- already had tax_engagements, engagement_assignments, engagement_shares,
-- engagement_status_history, the engagement_type/engagement_status enums,
-- and can_access_engagement()/can_manage_engagement() helpers from an
-- earlier scaffold; none of that is duplicated here.

-- ---------------------------------------------------------------------
-- New controlled-value enums that did not already exist.
-- ---------------------------------------------------------------------
create type public.tax_return_type as enum (
  '1040', '1040-X', '1065', '1120', '1120-S', '1041', '706', '709', '990',
  '941', '940', 'state_individual', 'state_business', 'local', 'other'
);

create type public.engagement_priority as enum ('low', 'normal', 'high', 'urgent');

create type public.engagement_efile_status as enum (
  'not_started', 'not_applicable', 'awaiting_authorization', 'ready',
  'transmitted', 'accepted', 'rejected', 'corrected', 'paper_filed'
);

create type public.engagement_payment_status as enum (
  'not_required', 'unpaid', 'partially_paid', 'paid', 'payment_plan',
  'refund_transfer', 'waived'
);

-- ---------------------------------------------------------------------
-- Extend the existing engagement_type enum with this phase's requested
-- vocabulary. Existing values (individual_return, business_return,
-- extension, bookkeeping, payroll) are kept for compatibility -- Postgres
-- cannot drop enum values in place, and nothing here needs to remove them.
-- ---------------------------------------------------------------------
alter type public.engagement_type add value if not exists 'individual';
alter type public.engagement_type add value if not exists 'business';
alter type public.engagement_type add value if not exists 'nonprofit';
alter type public.engagement_type add value if not exists 'extension_only';
alter type public.engagement_type add value if not exists 'notice_resolution';

-- ---------------------------------------------------------------------
-- Extend the existing engagement_status enum with this phase's requested
-- workflow states. Existing values not in the new vocabulary (e.g.
-- intake_not_started, missing_documents, preparation_in_progress,
-- awaiting_payment, ready_for_ero, sent_to_tax_software,
-- transmitted_externally, acknowledgement_pending, correction_in_progress)
-- are kept for compatibility but are not offered by the new engagement UI.
-- ---------------------------------------------------------------------
alter type public.engagement_status add value if not exists 'awaiting_client';
alter type public.engagement_status add value if not exists 'documents_requested';
alter type public.engagement_status add value if not exists 'in_preparation';
alter type public.engagement_status add value if not exists 'preparer_review';
alter type public.engagement_status add value if not exists 'reviewer_review';
alter type public.engagement_status add value if not exists 'ready_to_file';
alter type public.engagement_status add value if not exists 'filed';
alter type public.engagement_status add value if not exists 'extended';
alter type public.engagement_status add value if not exists 'on_hold';
