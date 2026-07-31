-- Continuation of the previous migration, split into its own file/
-- transaction because Postgres cannot use an enum value added by
-- ALTER TYPE ... ADD VALUE inside the same transaction that added it.

-- Drop the pre-existing 1-5 range check tied to the old smallint scale;
-- the new engagement_priority enum type replaces this constraint entirely.
alter table public.tax_engagements drop constraint if exists tax_engagements_priority_check;

-- Convert the existing free-form columns to the new controlled enums. Both
-- columns are currently empty in production (0 rows in tax_engagements as
-- of this migration), so this is a safe, non-destructive type change
-- rather than a data migration.
alter table public.tax_engagements
  alter column priority drop default,
  alter column priority type public.engagement_priority
    using (case priority
      when 1 then 'low' when 2 then 'low'
      when 3 then 'normal'
      when 4 then 'high' when 5 then 'high'
      else 'normal'
    end)::public.engagement_priority,
  alter column priority set default 'normal',
  alter column priority set not null;

alter table public.tax_engagements
  alter column return_type type public.tax_return_type
    using nullif(return_type, '')::public.tax_return_type;

-- New columns for assignment, dates, tax workflow detail, and operational
-- fields. service_id/document_request_id link to existing tables rather
-- than introducing new relationship tables. intake linkage is read via the
-- existing intake_submissions.engagement_id reverse relation rather than a
-- duplicate forward column.
alter table public.tax_engagements
  add column if not exists service_id uuid references public.services(id) on delete set null,
  add column if not exists engagement_number text,
  add column if not exists responsible_staff_user_id uuid,
  add column if not exists assigned_at timestamptz,
  add column if not exists internal_due_date date,
  add column if not exists extension_due_date date,
  add column if not exists started_at timestamptz,
  add column if not exists submitted_for_review_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists filed_at timestamptz,
  add column if not exists filing_status text,
  add column if not exists jurisdiction text,
  add column if not exists federal_return_required boolean not null default true,
  add column if not exists state_return_required boolean not null default false,
  add column if not exists local_return_required boolean not null default false,
  add column if not exists extension_requested boolean not null default false,
  add column if not exists extension_filed boolean not null default false,
  add column if not exists efile_authorization_received boolean not null default false,
  add column if not exists efile_status public.engagement_efile_status not null default 'not_started',
  add column if not exists payment_status public.engagement_payment_status not null default 'not_required',
  add column if not exists balance_due numeric(12, 2),
  add column if not exists refund_amount numeric(12, 2),
  add column if not exists description text,
  add column if not exists internal_notes text,
  add column if not exists document_request_id uuid references public.document_requests(id) on delete set null;

-- Business-rule guardrails (Part 9). tax_year range is already covered by
-- the pre-existing tax_engagements_tax_year_check (2000-2100); not
-- duplicated here.
alter table public.tax_engagements
  add constraint tax_engagements_money_nonnegative
    check (balance_due is null or balance_due >= 0),
  add constraint tax_engagements_refund_nonnegative
    check (refund_amount is null or refund_amount >= 0),
  add constraint tax_engagements_not_both_balance_and_refund
    check (balance_due is null or refund_amount is null or balance_due = 0 or refund_amount = 0),
  add constraint tax_engagements_extension_filed_implies_requested
    check (not extension_filed or extension_requested);

comment on column public.tax_engagements.priority is 'Converted from an unused smallint 1-5 scale (no application ever read it) to a controlled enum: low/normal/high/urgent.';
comment on column public.tax_engagements.return_type is 'Converted from free-form text to the tax_return_type enum.';
comment on column public.tax_engagements.engagement_number is 'Human-readable workspace-unique reference, e.g. TX-2025-000123. Assigned by a trigger (see engagement_reference_generation migration), not by the application.';

create index if not exists idx_tax_engagements_workspace_status on public.tax_engagements(workspace_id, status);
create index if not exists idx_tax_engagements_workspace_tax_year on public.tax_engagements(workspace_id, tax_year);
create index if not exists idx_tax_engagements_preparer on public.tax_engagements(primary_preparer_user_id);
create index if not exists idx_tax_engagements_reviewer on public.tax_engagements(reviewer_user_id);
create index if not exists idx_tax_engagements_due_date on public.tax_engagements(due_date);
create index if not exists idx_tax_engagements_client on public.tax_engagements(client_id);
