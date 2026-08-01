-- Verexa Tax Office backend workflow foundation
-- Adds the firm-configurable operating layer that connects existing clients,
-- engagements, templates, workflow automation, organizers, and ERO oversight.

begin;

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Service / engagement defaults
-- ---------------------------------------------------------------------------

create table public.engagement_type_settings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  engagement_type public.engagement_type not null,
  return_type public.tax_return_type,
  name text not null,
  is_active boolean not null default true,
  primary_workflow_definition_id uuid references public.workflow_definitions(id) on delete set null,
  organizer_template_id uuid references public.templates(id) on delete set null,
  organizer_template_version_id uuid references public.template_versions(id) on delete set null,
  engagement_letter_template_id uuid references public.templates(id) on delete set null,
  engagement_letter_template_version_id uuid references public.template_versions(id) on delete set null,
  document_checklist_template_id uuid references public.templates(id) on delete set null,
  document_checklist_template_version_id uuid references public.template_versions(id) on delete set null,
  pricing_method text not null default 'staff_entered'
    check (pricing_method in ('fixed','starting_at','range','staff_entered','rule_based')),
  pricing_config jsonb not null default '{}'::jsonb,
  reviewer_policy text not null default 'auto_ero'
    check (reviewer_policy in ('auto_ero','required','optional','none')),
  activation_default text not null default 'confirm_before_sending'
    check (activation_default in ('confirm_before_sending','activate_without_sending','activate_and_send')),
  deadline_settings jsonb not null default '{"use_statutory_rules":true}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (workspace_id, engagement_type, return_type)
);

comment on table public.engagement_type_settings is
  'One firm-level default configuration per engagement/return type. New engagements inherit this workflow, organizer, letter, pricing, reviewer, and deadline configuration automatically.';

-- A workflow definition already belongs to an immutable template version.
-- These tables add the human-facing pipeline stages and allowed transitions.
create table public.workflow_stages (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid not null references public.workflow_definitions(id) on delete cascade,
  stage_key text not null,
  label text not null,
  phase text not null,
  description text,
  sort_order integer not null,
  stage_kind text not null default 'standard'
    check (stage_kind in ('standard','exception','terminal')),
  engagement_status public.engagement_status,
  entry_actions jsonb not null default '[]'::jsonb,
  exit_requirements jsonb not null default '[]'::jsonb,
  default_assignee_role text,
  client_visible_label text,
  is_client_visible boolean not null default true,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workflow_definition_id, stage_key),
  unique (workflow_definition_id, sort_order)
);

create table public.workflow_stage_transitions (
  id uuid primary key default gen_random_uuid(),
  workflow_definition_id uuid not null references public.workflow_definitions(id) on delete cascade,
  from_stage_id uuid not null references public.workflow_stages(id) on delete cascade,
  to_stage_id uuid not null references public.workflow_stages(id) on delete cascade,
  label text,
  transition_kind text not null default 'normal'
    check (transition_kind in ('normal','correction','exception','resume')),
  conditions jsonb not null default '[]'::jsonb,
  requires_reason boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (workflow_definition_id, from_stage_id, to_stage_id)
);

create table public.engagement_workflow_instances (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  engagement_id uuid not null unique references public.tax_engagements(id) on delete cascade,
  engagement_type_setting_id uuid references public.engagement_type_settings(id) on delete set null,
  workflow_definition_id uuid not null references public.workflow_definitions(id) on delete restrict,
  template_version_id uuid not null references public.template_versions(id) on delete restrict,
  current_stage_key text,
  workflow_name text not null,
  workflow_version integer not null,
  snapshot jsonb not null,
  status text not null default 'active'
    check (status in ('active','paused','completed','cancelled','archived')),
  applied_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.engagement_workflow_stage_instances (
  id uuid primary key default gen_random_uuid(),
  workflow_instance_id uuid not null references public.engagement_workflow_instances(id) on delete cascade,
  source_stage_id uuid references public.workflow_stages(id) on delete set null,
  stage_key text not null,
  label text not null,
  phase text not null,
  description text,
  sort_order integer not null,
  stage_kind text not null,
  engagement_status public.engagement_status,
  entry_actions jsonb not null default '[]'::jsonb,
  exit_requirements jsonb not null default '[]'::jsonb,
  client_visible_label text,
  is_client_visible boolean not null default true,
  status text not null default 'pending'
    check (status in ('pending','current','completed','skipped','blocked')),
  entered_at timestamptz,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  notes text,
  unique (workflow_instance_id, stage_key),
  unique (workflow_instance_id, sort_order)
);

create table public.engagement_progress_trackers (
  engagement_id uuid primary key references public.tax_engagements(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  intake_status text not null default 'not_sent'
    check (intake_status in ('not_sent','sent','opened','in_progress','submitted','reviewed')),
  documents_status text not null default 'not_requested'
    check (documents_status in ('not_requested','requested','partial','complete','verified')),
  engagement_letter_status text not null default 'not_sent'
    check (engagement_letter_status in ('not_sent','sent','viewed','signed','declined','expired')),
  payment_status text not null default 'not_invoiced'
    check (payment_status in ('not_invoiced','invoiced','partial','paid','waived')),
  signature_status text not null default 'not_requested'
    check (signature_status in ('not_requested','requested','partial','complete','declined','expired')),
  extension_status text not null default 'not_needed'
    check (extension_status in ('not_needed','recommended','pending_approval','filed','accepted','rejected')),
  filing_status text not null default 'not_ready'
    check (filing_status in ('not_ready','ready','submitted_externally','accepted','rejected')),
  review_status text not null default 'not_assigned'
    check (review_status in ('not_required','not_assigned','assigned','under_review','corrections_required','approved')),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tax_engagements
  add column if not exists engagement_type_setting_id uuid references public.engagement_type_settings(id) on delete set null,
  add column if not exists review_required boolean not null default false,
  add column if not exists reviewer_locked_to_ero boolean not null default false;

-- ---------------------------------------------------------------------------
-- Deadline ledger: automatic statutory dates remain distinct from staff dates.
-- ---------------------------------------------------------------------------

create table public.engagement_deadlines (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  engagement_id uuid not null references public.tax_engagements(id) on delete cascade,
  jurisdiction text not null,
  deadline_type text not null
    check (deadline_type in (
      'statutory_filing','extended_filing','payment','estimated_payment',
      'client_document','internal_preparation','reviewer','signature','custom'
    )),
  label text not null,
  due_on date not null,
  source text not null default 'staff'
    check (source in ('federal_rule','state_rule','local_rule','staff')),
  source_rule_id uuid references public.tax_deadline_rules(id) on delete set null,
  is_active boolean not null default true,
  is_satisfied boolean not null default false,
  satisfied_at timestamptz,
  satisfied_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (engagement_id, jurisdiction, deadline_type, due_on)
);

-- ---------------------------------------------------------------------------
-- Lead forms, pricing assessments, quotes, and change orders
-- ---------------------------------------------------------------------------

create table public.lead_forms (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  template_id uuid not null references public.templates(id) on delete restrict,
  published_version_id uuid references public.template_versions(id) on delete restrict,
  name text not null,
  public_slug text not null unique,
  status text not null default 'draft'
    check (status in ('draft','published','paused','archived')),
  confirmation_message text not null default 'Thank you. The firm received your request and will contact you soon.',
  assigned_user_id uuid references auth.users(id) on delete set null,
  lead_source text not null default 'website_lead_form',
  lead_workflow_definition_id uuid references public.workflow_definitions(id) on delete set null,
  embed_settings jsonb not null default '{}'::jsonb,
  notification_settings jsonb not null default '{}'::jsonb,
  duplicate_check_enabled boolean not null default true,
  consent_text text not null default 'I consent to be contacted about the services I requested.',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lead_form_submissions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_form_id uuid not null references public.lead_forms(id) on delete restrict,
  template_version_id uuid not null references public.template_versions(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete set null,
  payload jsonb not null,
  status text not null default 'received'
    check (status in ('received','reviewed','converted','spam','archived')),
  consent_given boolean not null,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
);

create table public.pricing_assessments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  engagement_id uuid references public.tax_engagements(id) on delete set null,
  template_id uuid not null references public.templates(id) on delete restrict,
  template_version_id uuid not null references public.template_versions(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft','sent','opened','submitted','reviewed','archived')),
  answers jsonb not null default '{}'::jsonb,
  recommended_min numeric(12,2),
  recommended_max numeric(12,2),
  recommended_price numeric(12,2),
  pricing_breakdown jsonb not null default '[]'::jsonb,
  sent_at timestamptz,
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (lead_id is not null or client_id is not null),
  check (recommended_min is null or recommended_min >= 0),
  check (recommended_max is null or recommended_max >= 0),
  check (recommended_price is null or recommended_price >= 0)
);

create table public.pricing_rules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  engagement_type_setting_id uuid not null references public.engagement_type_settings(id) on delete cascade,
  name text not null,
  description text,
  condition jsonb not null,
  adjustment_type text not null
    check (adjustment_type in ('fixed_amount','per_item','percentage','minimum','maximum','price_range')),
  amount numeric(12,2),
  amount_max numeric(12,2),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount is null or amount >= 0),
  check (amount_max is null or amount_max >= 0)
);

create table public.client_quotes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  engagement_id uuid references public.tax_engagements(id) on delete set null,
  pricing_assessment_id uuid references public.pricing_assessments(id) on delete set null,
  quote_number text not null,
  quote_type text not null default 'initial'
    check (quote_type in ('initial','change_order')),
  pricing_method text not null,
  amount_min numeric(12,2),
  amount_max numeric(12,2),
  amount numeric(12,2),
  line_items jsonb not null default '[]'::jsonb,
  status text not null default 'draft'
    check (status in ('draft','sent','viewed','accepted','declined','expired','superseded')),
  disclaimer text not null default 'This is a preliminary estimate based on the information provided. Additional work discovered during full intake or document review may require a client-approved change order.',
  valid_until date,
  sent_at timestamptz,
  accepted_at timestamptz,
  accepted_by_name text,
  supersedes_quote_id uuid references public.client_quotes(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, quote_number),
  check (lead_id is not null or client_id is not null),
  check (amount_min is null or amount_min >= 0),
  check (amount_max is null or amount_max >= 0),
  check (amount is null or amount >= 0)
);

-- ---------------------------------------------------------------------------
-- Exact duplicate matching for sensitive identifiers.
-- Store only a keyed HMAC generated by trusted server code; never raw SSN/ITIN/EIN.
-- ---------------------------------------------------------------------------

create table private.client_identifier_fingerprints (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  identifier_type text not null check (identifier_type in ('ssn','itin','ein')),
  fingerprint text not null check (fingerprint ~ '^[A-Fa-f0-9]{64,128}$'),
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, identifier_type, fingerprint),
  unique (workspace_id, client_id, identifier_type)
);

comment on table private.client_identifier_fingerprints is
  'HMAC fingerprints for exact duplicate detection. HMAC must be computed server-side with a secret that is never stored in the browser or this table.';

create index client_email_normalized_idx on public.clients (workspace_id, lower(btrim(email))) where email is not null;
create index client_phone_normalized_idx on public.clients (workspace_id, regexp_replace(phone, '[^0-9]', '', 'g')) where phone is not null;
create index lead_email_normalized_idx on public.leads (workspace_id, lower(btrim(email))) where email is not null;
create index lead_phone_normalized_idx on public.leads (workspace_id, regexp_replace(phone, '[^0-9]', '', 'g')) where phone is not null;
create index client_identifier_fingerprint_lookup_idx on private.client_identifier_fingerprints (workspace_id, fingerprint);

-- ---------------------------------------------------------------------------
-- RLS and explicit Data API grants
-- ---------------------------------------------------------------------------

alter table public.engagement_type_settings enable row level security;
alter table public.workflow_stages enable row level security;
alter table public.workflow_stage_transitions enable row level security;
alter table public.engagement_workflow_instances enable row level security;
alter table public.engagement_workflow_stage_instances enable row level security;
alter table public.engagement_progress_trackers enable row level security;
alter table public.engagement_deadlines enable row level security;
alter table public.lead_forms enable row level security;
alter table public.lead_form_submissions enable row level security;
alter table public.pricing_assessments enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.client_quotes enable row level security;
alter table private.client_identifier_fingerprints enable row level security;

grant select, insert, update, delete on table public.engagement_type_settings to authenticated, service_role;
grant select, insert, update, delete on table public.workflow_stages to authenticated, service_role;
grant select, insert, update, delete on table public.workflow_stage_transitions to authenticated, service_role;
grant select, insert, update, delete on table public.engagement_workflow_instances to authenticated, service_role;
grant select, insert, update, delete on table public.engagement_workflow_stage_instances to authenticated, service_role;
grant select, insert, update, delete on table public.engagement_progress_trackers to authenticated, service_role;
grant select, insert, update, delete on table public.engagement_deadlines to authenticated, service_role;
grant select, insert, update, delete on table public.lead_forms to authenticated, service_role;
grant select, insert, update, delete on table public.lead_form_submissions to authenticated, service_role;
grant select, insert, update, delete on table public.pricing_assessments to authenticated, service_role;
grant select, insert, update, delete on table public.pricing_rules to authenticated, service_role;
grant select, insert, update, delete on table public.client_quotes to authenticated, service_role;

revoke all on table private.client_identifier_fingerprints from public, anon, authenticated;
grant all on table private.client_identifier_fingerprints to service_role;

create policy engagement_type_settings_select on public.engagement_type_settings for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy engagement_type_settings_manage on public.engagement_type_settings for all to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin','ero']::public.membership_role[]) or public.is_platform_admin())
  with check (public.has_workspace_role(workspace_id, array['owner','admin','ero']::public.membership_role[]) or public.is_platform_admin());

create policy workflow_stages_select on public.workflow_stages for select to authenticated
  using (public.can_access_workflow_definition(workflow_definition_id));
create policy workflow_stages_manage on public.workflow_stages for all to authenticated
  using (public.can_manage_workflow_definition(workflow_definition_id))
  with check (public.can_manage_workflow_definition(workflow_definition_id));
create policy workflow_stage_transitions_select on public.workflow_stage_transitions for select to authenticated
  using (public.can_access_workflow_definition(workflow_definition_id));
create policy workflow_stage_transitions_manage on public.workflow_stage_transitions for all to authenticated
  using (public.can_manage_workflow_definition(workflow_definition_id))
  with check (public.can_manage_workflow_definition(workflow_definition_id));

create policy engagement_workflow_instances_select on public.engagement_workflow_instances for select to authenticated
  using (public.can_access_engagement(engagement_id) or public.is_platform_admin());
create policy engagement_workflow_instances_manage on public.engagement_workflow_instances for all to authenticated
  using (public.can_manage_engagement(engagement_id) or public.is_platform_admin())
  with check (public.can_manage_engagement(engagement_id) or public.is_platform_admin());
create policy engagement_workflow_stage_instances_select on public.engagement_workflow_stage_instances for select to authenticated
  using (exists (select 1 from public.engagement_workflow_instances i where i.id=workflow_instance_id and public.can_access_engagement(i.engagement_id)) or public.is_platform_admin());
create policy engagement_workflow_stage_instances_manage on public.engagement_workflow_stage_instances for all to authenticated
  using (exists (select 1 from public.engagement_workflow_instances i where i.id=workflow_instance_id and public.can_manage_engagement(i.engagement_id)) or public.is_platform_admin())
  with check (exists (select 1 from public.engagement_workflow_instances i where i.id=workflow_instance_id and public.can_manage_engagement(i.engagement_id)) or public.is_platform_admin());

create policy engagement_progress_trackers_select on public.engagement_progress_trackers for select to authenticated
  using (public.can_access_engagement(engagement_id) or public.is_platform_admin());
create policy engagement_progress_trackers_manage on public.engagement_progress_trackers for all to authenticated
  using (public.can_manage_engagement(engagement_id) or public.is_platform_admin())
  with check (public.can_manage_engagement(engagement_id) or public.is_platform_admin());
create policy engagement_deadlines_select on public.engagement_deadlines for select to authenticated
  using (public.can_access_engagement(engagement_id) or public.is_platform_admin());
create policy engagement_deadlines_manage on public.engagement_deadlines for all to authenticated
  using (public.can_manage_engagement(engagement_id) or public.is_platform_admin())
  with check (public.can_manage_engagement(engagement_id) or public.is_platform_admin());

create policy lead_forms_select on public.lead_forms for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy lead_forms_manage on public.lead_forms for all to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin','ero','preparer']::public.membership_role[]) or public.is_platform_admin())
  with check (public.has_workspace_role(workspace_id, array['owner','admin','ero','preparer']::public.membership_role[]) or public.is_platform_admin());
create policy lead_form_submissions_select on public.lead_form_submissions for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy lead_form_submissions_manage on public.lead_form_submissions for all to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin','ero','preparer','intake_specialist']::public.membership_role[]) or public.is_platform_admin())
  with check (public.has_workspace_role(workspace_id, array['owner','admin','ero','preparer','intake_specialist']::public.membership_role[]) or public.is_platform_admin());

create policy pricing_assessments_select on public.pricing_assessments for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy pricing_assessments_manage on public.pricing_assessments for all to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin','ero','preparer','intake_specialist']::public.membership_role[]) or public.is_platform_admin())
  with check (public.has_workspace_role(workspace_id, array['owner','admin','ero','preparer','intake_specialist']::public.membership_role[]) or public.is_platform_admin());
create policy pricing_rules_select on public.pricing_rules for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy pricing_rules_manage on public.pricing_rules for all to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin','ero']::public.membership_role[]) or public.is_platform_admin())
  with check (public.has_workspace_role(workspace_id, array['owner','admin','ero']::public.membership_role[]) or public.is_platform_admin());
create policy client_quotes_select on public.client_quotes for select to authenticated
  using (public.is_workspace_member(workspace_id) or public.is_platform_admin());
create policy client_quotes_manage on public.client_quotes for all to authenticated
  using (public.has_workspace_role(workspace_id, array['owner','admin','ero','preparer','billing']::public.membership_role[]) or public.is_platform_admin())
  with check (public.has_workspace_role(workspace_id, array['owner','admin','ero','preparer','billing']::public.membership_role[]) or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Trigger helpers
-- ---------------------------------------------------------------------------

create or replace function private.set_engagement_reviewer_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace_type public.workspace_type;
  v_ero_workspace_id uuid;
  v_reviewer_id uuid;
  v_preparer_role public.membership_role;
  v_policy text := 'auto_ero';
begin
  select w.workspace_type into v_workspace_type
  from public.workspaces w where w.id=new.workspace_id;

  select s.reviewer_policy into v_policy
  from public.engagement_type_settings s
  where s.workspace_id=new.workspace_id and s.engagement_type=new.engagement_type
    and (s.return_type is null or s.return_type=new.return_type) and s.is_active
  order by (s.return_type is not null) desc limit 1;

  if v_workspace_type='independent_ptin' then
    select case when r.source_workspace_id=new.workspace_id then r.target_workspace_id else r.source_workspace_id end
    into v_ero_workspace_id
    from public.workspace_relationships r
    join public.workspaces counterpart on counterpart.id=case when r.source_workspace_id=new.workspace_id then r.target_workspace_id else r.source_workspace_id end
    where r.status='active' and r.relationship_type='ptin_to_ero'
      and (r.source_workspace_id=new.workspace_id or r.target_workspace_id=new.workspace_id)
      and counterpart.workspace_type='ero_office'
    order by r.created_at limit 1;

    if v_ero_workspace_id is not null then
      select wm.user_id into v_reviewer_id
      from public.workspace_members wm
      where wm.workspace_id=v_ero_workspace_id and wm.status='active'
        and wm.role in ('ero','owner','admin','reviewer')
      order by case wm.role when 'ero' then 1 when 'owner' then 2 when 'reviewer' then 3 else 4 end, wm.created_at
      limit 1;
      new.ero_workspace_id := v_ero_workspace_id;
      new.review_required := true;
      new.reviewer_locked_to_ero := true;
      new.reviewer_user_id := coalesce(new.reviewer_user_id,v_reviewer_id);
    else
      new.review_required := (v_policy='required');
      new.reviewer_locked_to_ero := false;
      if v_policy in ('none','auto_ero') then new.reviewer_user_id := null; end if;
    end if;
  elsif v_workspace_type='ero_office' then
    select wm.role into v_preparer_role from public.workspace_members wm
    where wm.workspace_id=new.workspace_id and wm.user_id=new.primary_preparer_user_id and wm.status='active'
    limit 1;
    if v_preparer_role in ('preparer','seasonal_staff') or v_policy='required' then
      select wm.user_id into v_reviewer_id
      from public.workspace_members wm
      where wm.workspace_id=new.workspace_id and wm.status='active'
        and wm.role in ('ero','owner','admin','reviewer')
      order by case wm.role when 'ero' then 1 when 'owner' then 2 when 'reviewer' then 3 else 4 end, wm.created_at
      limit 1;
      new.review_required := true;
      new.reviewer_locked_to_ero := false;
      new.reviewer_user_id := coalesce(new.reviewer_user_id,v_reviewer_id);
    else
      new.review_required := (v_policy='required');
    end if;
  else
    new.review_required := (v_policy='required');
  end if;
  return new;
end;
$$;

revoke all on function private.set_engagement_reviewer_defaults() from public, anon, authenticated;

create trigger tax_engagements_set_reviewer_defaults
before insert or update of workspace_id, engagement_type, return_type, primary_preparer_user_id
on public.tax_engagements
for each row execute function private.set_engagement_reviewer_defaults();

create or replace function private.validate_engagement_reviewer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_allowed_workspace uuid;
begin
  if new.reviewer_user_id is null then return new; end if;
  v_allowed_workspace := case when new.reviewer_locked_to_ero and new.ero_workspace_id is not null then new.ero_workspace_id else new.workspace_id end;
  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id=v_allowed_workspace and wm.user_id=new.reviewer_user_id and wm.status='active'
  ) then
    raise exception 'Reviewer must be active staff in the permitted ERO/firm workspace';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_engagement_reviewer() from public, anon, authenticated;

create trigger tax_engagements_validate_reviewer
before insert or update of reviewer_user_id, ero_workspace_id, reviewer_locked_to_ero
on public.tax_engagements
for each row execute function private.validate_engagement_reviewer();

create or replace function private.apply_engagement_operating_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_setting public.engagement_type_settings%rowtype;
  v_definition public.workflow_definitions%rowtype;
  v_template public.templates%rowtype;
  v_version public.template_versions%rowtype;
  v_instance_id uuid;
  v_first_stage public.workflow_stages%rowtype;
  v_snapshot jsonb;
begin
  select * into v_setting from public.engagement_type_settings s
  where s.workspace_id=new.workspace_id and s.engagement_type=new.engagement_type
    and (s.return_type is null or s.return_type=new.return_type) and s.is_active
  order by (s.return_type is not null) desc limit 1;

  if v_setting.primary_workflow_definition_id is not null then
    select * into v_definition from public.workflow_definitions where id=v_setting.primary_workflow_definition_id and is_active;
  end if;

  if v_definition.id is null then
    select d.* into v_definition
    from public.workflow_definitions d
    join public.templates t on t.id=d.template_id
    where t.is_system_template and t.kind='workflow' and t.metadata->>'intended_use'='tax_preparation'
      and d.is_active
    order by d.created_at limit 1;
  end if;

  if v_definition.id is null then
    insert into public.engagement_progress_trackers(engagement_id,workspace_id,review_status)
    values(new.id,new.workspace_id,case when new.review_required then 'not_assigned' else 'not_required' end)
    on conflict (engagement_id) do nothing;
    return new;
  end if;

  select * into v_template from public.templates where id=v_definition.template_id;
  select * into v_version from public.template_versions where id=v_definition.template_version_id;
  select * into v_first_stage from public.workflow_stages
  where workflow_definition_id=v_definition.id and stage_kind='standard'
  order by sort_order limit 1;

  select jsonb_build_object(
    'definition_id',v_definition.id,'template_id',v_template.id,'template_version_id',v_version.id,
    'workflow_name',v_definition.name,'version_number',v_version.version_number,
    'stages',coalesce(jsonb_agg(jsonb_build_object(
      'stage_key',s.stage_key,'label',s.label,'phase',s.phase,'description',s.description,
      'sort_order',s.sort_order,'stage_kind',s.stage_kind,'engagement_status',s.engagement_status,
      'entry_actions',s.entry_actions,'exit_requirements',s.exit_requirements,
      'client_visible_label',s.client_visible_label,'is_client_visible',s.is_client_visible
    ) order by s.sort_order),'[]'::jsonb)
  ) into v_snapshot
  from public.workflow_stages s where s.workflow_definition_id=v_definition.id;

  insert into public.engagement_workflow_instances(
    workspace_id,engagement_id,engagement_type_setting_id,workflow_definition_id,template_version_id,
    current_stage_key,workflow_name,workflow_version,snapshot,applied_by
  ) values(
    new.workspace_id,new.id,v_setting.id,v_definition.id,v_version.id,v_first_stage.stage_key,
    v_definition.name,v_version.version_number,v_snapshot,new.created_by
  ) returning id into v_instance_id;

  insert into public.engagement_workflow_stage_instances(
    workflow_instance_id,source_stage_id,stage_key,label,phase,description,sort_order,stage_kind,
    engagement_status,entry_actions,exit_requirements,client_visible_label,is_client_visible,status,entered_at
  )
  select v_instance_id,s.id,s.stage_key,s.label,s.phase,s.description,s.sort_order,s.stage_kind,
    s.engagement_status,s.entry_actions,s.exit_requirements,s.client_visible_label,s.is_client_visible,
    case when s.id=v_first_stage.id then 'current' else 'pending' end,
    case when s.id=v_first_stage.id then now() else null end
  from public.workflow_stages s where s.workflow_definition_id=v_definition.id order by s.sort_order;

  insert into public.engagement_progress_trackers(engagement_id,workspace_id,review_status)
  values(new.id,new.workspace_id,case when new.review_required and new.reviewer_user_id is not null then 'assigned' when new.review_required then 'not_assigned' else 'not_required' end)
  on conflict (engagement_id) do nothing;

  update public.tax_engagements set engagement_type_setting_id=v_setting.id where id=new.id;
  return new;
end;
$$;

revoke all on function private.apply_engagement_operating_defaults() from public, anon, authenticated;

create trigger tax_engagements_apply_operating_defaults
after insert on public.tax_engagements
for each row execute function private.apply_engagement_operating_defaults();

create or replace function private.seed_engagement_deadlines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_rule public.tax_deadline_rules%rowtype;
begin
  if new.tax_year is null or new.return_type is null then return new; end if;
  for v_rule in
    select r.* from public.tax_deadline_rules r
    where r.tax_year=new.tax_year and r.return_type=new.return_type and r.is_active
      and (r.workspace_id is null or r.workspace_id=new.workspace_id)
      and (lower(r.jurisdiction)='federal' or r.jurisdiction=any(string_to_array(coalesce(new.jurisdiction,''),', ')))
    order by (r.workspace_id is not null) desc
  loop
    insert into public.engagement_deadlines(workspace_id,engagement_id,jurisdiction,deadline_type,label,due_on,source,source_rule_id)
    values(new.workspace_id,new.id,v_rule.jurisdiction,'statutory_filing',new.tax_year||' '||v_rule.jurisdiction||' filing deadline',v_rule.original_due_date,
      case when lower(v_rule.jurisdiction)='federal' then 'federal_rule' else 'state_rule' end,v_rule.id)
    on conflict do nothing;
    insert into public.engagement_deadlines(workspace_id,engagement_id,jurisdiction,deadline_type,label,due_on,source,source_rule_id)
    values(new.workspace_id,new.id,v_rule.jurisdiction,'payment',new.tax_year||' '||v_rule.jurisdiction||' payment deadline',v_rule.original_due_date,
      case when lower(v_rule.jurisdiction)='federal' then 'federal_rule' else 'state_rule' end,v_rule.id)
    on conflict do nothing;
    if v_rule.extension_due_date is not null then
      insert into public.engagement_deadlines(workspace_id,engagement_id,jurisdiction,deadline_type,label,due_on,source,source_rule_id,is_active)
      values(new.workspace_id,new.id,v_rule.jurisdiction,'extended_filing',new.tax_year||' '||v_rule.jurisdiction||' extended filing deadline',v_rule.extension_due_date,
        case when lower(v_rule.jurisdiction)='federal' then 'federal_rule' else 'state_rule' end,v_rule.id,new.extension_filed)
      on conflict do nothing;
    end if;
  end loop;
  if new.internal_due_date is not null then
    insert into public.engagement_deadlines(workspace_id,engagement_id,jurisdiction,deadline_type,label,due_on,source)
    values(new.workspace_id,new.id,'Firm','internal_preparation','Internal preparation target',new.internal_due_date,'staff') on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.seed_engagement_deadlines() from public, anon, authenticated;
create trigger tax_engagements_seed_deadlines after insert on public.tax_engagements
for each row execute function private.seed_engagement_deadlines();

-- ---------------------------------------------------------------------------
-- Secure RPCs used by the future frontend/server layer
-- ---------------------------------------------------------------------------

create or replace function public.find_possible_duplicate_clients(
  p_workspace_id uuid,
  p_email text default null,
  p_phone text default null,
  p_identifier_fingerprint text default null
)
returns table(
  client_id uuid, display_name text, masked_email text, masked_phone text,
  identifier_type text, identifier_last4 text, client_status text, assigned_user_id uuid,
  match_reasons text[]
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (public.is_workspace_member(p_workspace_id) or public.is_platform_admin()) then
    raise exception 'Not authorized';
  end if;
  return query
  with matches as (
    select c.id,
      trim(coalesce(c.display_name,concat_ws(' ',c.first_name,c.last_name),c.company)) as name,
      c.email,c.phone,c.status,c.assigned_user_id,
      f.identifier_type,f.last4,
      array_remove(array[
        case when p_email is not null and lower(btrim(c.email))=lower(btrim(p_email)) then 'email' end,
        case when p_phone is not null and regexp_replace(c.phone,'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g') then 'phone' end,
        case when p_identifier_fingerprint is not null and f.fingerprint=p_identifier_fingerprint then coalesce(f.identifier_type,'identifier') end
      ],null) reasons
    from public.clients c
    left join private.client_identifier_fingerprints f on f.client_id=c.id and f.workspace_id=c.workspace_id
    where c.workspace_id=p_workspace_id and (
      (p_email is not null and lower(btrim(c.email))=lower(btrim(p_email))) or
      (p_phone is not null and regexp_replace(c.phone,'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g')) or
      (p_identifier_fingerprint is not null and f.fingerprint=p_identifier_fingerprint)
    )
  )
  select m.id,m.name,
    case when m.email is null then null else left(m.email,2)||'***@'||split_part(m.email,'@',2) end,
    case when m.phone is null then null else '***-***-'||right(regexp_replace(m.phone,'[^0-9]','','g'),4) end,
    m.identifier_type,m.last4,m.status,m.assigned_user_id,m.reasons
  from matches m;
end;
$$;

revoke all on function public.find_possible_duplicate_clients(uuid,text,text,text) from public, anon;
grant execute on function public.find_possible_duplicate_clients(uuid,text,text,text) to authenticated, service_role;

create or replace function private.contains_prohibited_lead_key(p_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with recursive walk(value) as (
    select p_value
    union all
    select child.value
    from walk w
    cross join lateral (
      select value from jsonb_each(case when jsonb_typeof(w.value)='object' then w.value else '{}'::jsonb end)
      union all
      select value from jsonb_array_elements(case when jsonb_typeof(w.value)='array' then w.value else '[]'::jsonb end)
    ) child
  )
  select exists(
    select 1 from walk w,
      lateral jsonb_object_keys(case when jsonb_typeof(w.value)='object' then w.value else '{}'::jsonb end) k(key)
    where lower(regexp_replace(k.key,'[^a-z0-9]','','g')) in (
        'ssn','socialsecuritynumber','itin','ein','bankaccount','accountnumber','routingnumber','taxdocument'
      )
  );
$$;

revoke all on function private.contains_prohibited_lead_key(jsonb) from public, anon, authenticated;

create or replace function public.submit_public_lead_form(
  p_public_slug text,
  p_payload jsonb,
  p_consent_given boolean,
  p_honeypot text default null
)
returns table(lead_id uuid, submission_id uuid, confirmation_message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_form public.lead_forms%rowtype;
  v_lead_id uuid;
  v_submission_id uuid;
  v_email text := nullif(btrim(p_payload->>'email'),'');
  v_phone text := nullif(btrim(p_payload->>'phone'),'');
  v_services text;
begin
  if nullif(btrim(coalesce(p_honeypot,'')),'') is not null then raise exception 'Submission rejected'; end if;
  if not p_consent_given then raise exception 'Consent is required'; end if;
  if pg_column_size(p_payload)>32768 then raise exception 'Submission is too large'; end if;
  if private.contains_prohibited_lead_key(p_payload) then raise exception 'Sensitive identifiers and tax documents are not permitted on public lead forms'; end if;
  if v_email is null and v_phone is null then raise exception 'Email or phone is required'; end if;

  select * into v_form from public.lead_forms
  where public_slug=p_public_slug and status='published' and published_version_id is not null;
  if not found then raise exception 'Lead form is unavailable'; end if;

  v_services := case when jsonb_typeof(p_payload->'services')='array'
    then (select string_agg(value,', ') from jsonb_array_elements_text(p_payload->'services'))
    else nullif(p_payload->>'service_interest','') end;

  insert into public.leads(
    workspace_id,first_name,last_name,email,phone,company,service_interest,status,source,
    assigned_user_id,notes,metadata
  ) values(
    v_form.workspace_id,coalesce(nullif(btrim(p_payload->>'first_name'),''),'Website'),
    coalesce(nullif(btrim(p_payload->>'last_name'),''),'Lead'),v_email,v_phone,
    nullif(btrim(p_payload->>'company'),''),v_services,'new',v_form.lead_source,
    v_form.assigned_user_id,nullif(btrim(p_payload->>'description'),''),
    jsonb_build_object('lead_form_id',v_form.id,'tax_years',coalesce(p_payload->'tax_years','[]'::jsonb),
      'states',coalesce(p_payload->'states','[]'::jsonb),'preferred_contact_method',p_payload->>'preferred_contact_method')
  ) returning id into v_lead_id;

  insert into public.lead_form_submissions(
    workspace_id,lead_form_id,template_version_id,lead_id,payload,consent_given
  ) values(v_form.workspace_id,v_form.id,v_form.published_version_id,v_lead_id,p_payload,p_consent_given)
  returning id into v_submission_id;

  return query select v_lead_id,v_submission_id,v_form.confirmation_message;
end;
$$;

revoke all on function public.submit_public_lead_form(text,jsonb,boolean,text) from public;
grant execute on function public.submit_public_lead_form(text,jsonb,boolean,text) to anon, authenticated, service_role;

create or replace function public.set_engagement_workflow_stage(
  p_engagement_id uuid,
  p_stage_key text,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_instance public.engagement_workflow_instances%rowtype;
  v_current public.engagement_workflow_stage_instances%rowtype;
  v_target public.engagement_workflow_stage_instances%rowtype;
begin
  if not public.can_manage_engagement(p_engagement_id) then raise exception 'Not authorized'; end if;
  select * into v_instance from public.engagement_workflow_instances where engagement_id=p_engagement_id for update;
  if not found then raise exception 'No workflow is assigned to this engagement'; end if;
  select * into v_current from public.engagement_workflow_stage_instances where workflow_instance_id=v_instance.id and status='current' for update;
  select * into v_target from public.engagement_workflow_stage_instances where workflow_instance_id=v_instance.id and stage_key=p_stage_key;
  if not found then raise exception 'Workflow stage not found'; end if;
  if v_current.id=v_target.id then return v_target.id; end if;
  if v_target.stage_kind<>'exception' and not exists(
    select 1 from public.workflow_stage_transitions t
    where t.workflow_definition_id=v_instance.workflow_definition_id
      and t.from_stage_id=v_current.source_stage_id and t.to_stage_id=v_target.source_stage_id
      and (not t.requires_reason or nullif(btrim(p_reason),'') is not null)
  ) then raise exception 'This stage transition is not allowed'; end if;

  update public.engagement_workflow_stage_instances
  set status='completed',completed_at=now(),completed_by=auth.uid(),notes=coalesce(p_reason,notes)
  where id=v_current.id;
  update public.engagement_workflow_stage_instances set status='current',entered_at=now() where id=v_target.id;
  update public.engagement_workflow_instances set current_stage_key=v_target.stage_key,updated_at=now(),
    status=case when v_target.stage_kind='terminal' then 'completed' else status end,
    completed_at=case when v_target.stage_kind='terminal' then now() else completed_at end
  where id=v_instance.id;
  if v_target.engagement_status is not null then
    update public.tax_engagements set status=v_target.engagement_status,status_source='manual' where id=p_engagement_id;
  end if;
  perform public.log_engagement_activity(p_engagement_id,'stage_changed','Workflow stage changed',v_current.stage_key,v_target.stage_key,
    jsonb_build_object('reason',p_reason,'workflow_instance_id',v_instance.id));
  return v_target.id;
end;
$$;

revoke all on function public.set_engagement_workflow_stage(uuid,text,text) from public, anon;
grant execute on function public.set_engagement_workflow_stage(uuid,text,text) to authenticated, service_role;

-- Standard updated_at triggers.
create trigger engagement_type_settings_updated_at before update on public.engagement_type_settings for each row execute function public.set_updated_at();
create trigger workflow_stages_updated_at before update on public.workflow_stages for each row execute function public.set_updated_at();
create trigger engagement_workflow_instances_updated_at before update on public.engagement_workflow_instances for each row execute function public.set_updated_at();
create trigger engagement_progress_trackers_updated_at before update on public.engagement_progress_trackers for each row execute function public.set_updated_at();
create trigger engagement_deadlines_updated_at before update on public.engagement_deadlines for each row execute function public.set_updated_at();
create trigger lead_forms_updated_at before update on public.lead_forms for each row execute function public.set_updated_at();
create trigger pricing_assessments_updated_at before update on public.pricing_assessments for each row execute function public.set_updated_at();
create trigger pricing_rules_updated_at before update on public.pricing_rules for each row execute function public.set_updated_at();
create trigger client_quotes_updated_at before update on public.client_quotes for each row execute function public.set_updated_at();
create trigger client_identifier_fingerprints_updated_at before update on private.client_identifier_fingerprints for each row execute function public.set_updated_at();

comment on type public.client_type is
  'Client records should use individual or business. The legacy household value is deprecated; use tax_households and household_members to relate people without merging their records.';

commit;
