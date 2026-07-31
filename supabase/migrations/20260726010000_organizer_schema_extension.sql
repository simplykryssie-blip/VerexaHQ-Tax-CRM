-- Guided Tax Organizer (Part 1 audit finding): the existing intake system
-- (intake_submissions/form_sections/form_fields/form_conditions/
-- intake_answers/intake_household_people/intake_repeatable_entities/
-- intake_document_rules/intake_review_*) already implements the vast
-- majority of what an "organizer" needs — versioned templates, conditional
-- visibility, repeatable groups, review workflow, clarifications, document
-- rules, and an auto-recalculated progress percentage. This phase extends
-- that system rather than duplicating it under a new "organizer_*" schema.
--
-- This migration adds only the columns genuinely missing: resume-at-section,
-- a due date, prior-year rollover lineage/flags, and a distinct
-- changes-requested timestamp. New enum values (added in their own
-- transaction below, per Postgres's ALTER TYPE ADD VALUE restriction) give
-- the business/nonprofit/planning organizer templates the question types
-- and repeatable-entity kinds they need.

alter table public.intake_submissions
  add column if not exists due_date date,
  add column if not exists current_section_id uuid references public.form_sections(id) on delete set null,
  add column if not exists source_submission_id uuid references public.intake_submissions(id) on delete set null,
  add column if not exists changes_requested_at timestamptz;

comment on column public.intake_submissions.due_date is 'Organizer due date, set by staff at assignment. Not client-editable.';
comment on column public.intake_submissions.current_section_id is 'Last section the client was on — lets "Continue Organizer" resume at the right step. Client-editable (own submission only).';
comment on column public.intake_submissions.source_submission_id is 'Prior-year intake_submissions row this one was rolled forward from, if any. Set once at creation by roll_forward_organizer; never client-editable.';
comment on column public.intake_submissions.changes_requested_at is 'Timestamp of the most recent "changes requested" transition, distinct from reopened_at (staff request vs. staff reopen are different events).';

create index if not exists idx_intake_submissions_source_submission on public.intake_submissions(source_submission_id);
create index if not exists idx_intake_submissions_engagement_active on public.intake_submissions(engagement_id) where engagement_id is not null;

alter table public.intake_answers
  add column if not exists confirmed_by_client boolean not null default false,
  add column if not exists rolled_forward boolean not null default false;

comment on column public.intake_answers.rolled_forward is 'True if this answer value was copied from a prior-year submission rather than entered by the client this year.';
comment on column public.intake_answers.confirmed_by_client is 'For rolled_forward answers, true once the client has reviewed and confirmed (or edited) the carried-forward value this year.';

alter table public.intake_household_people
  add column if not exists confirmed_by_client boolean not null default false,
  add column if not exists rolled_forward boolean not null default false;

alter table public.intake_repeatable_entities
  add column if not exists confirmed_by_client boolean not null default false,
  add column if not exists rolled_forward boolean not null default false;
