-- Correction pass (manual Vercel Preview testing feedback) on top of the
-- verified feature/guided-client-engagement checkpoint (1d97052).
-- Purely additive: new tables/columns/functions/permissions only. No existing
-- table, column, row, or migration is altered or removed.

-- =====================================================================
-- 1. Lead sources (workspace-configurable, replaces free-text Source)
-- =====================================================================

create table if not exists public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  label text not null,
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, label)
);

comment on table public.lead_sources is
  'Workspace-configurable lead source options. workspace_id null = system default, visible to every workspace. Never hard-deleted once attached to a lead — deactivate/archive instead.';

alter table public.lead_sources enable row level security;

drop policy if exists lead_sources_read on public.lead_sources;
create policy lead_sources_read on public.lead_sources
  for select to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));

drop policy if exists lead_sources_manage on public.lead_sources;
create policy lead_sources_manage on public.lead_sources
  for all to authenticated
  using (workspace_id is not null and not is_system and public.has_permission(workspace_id, 'lead_sources.manage'))
  with check (workspace_id is not null and not is_system and public.has_permission(workspace_id, 'lead_sources.manage'));

insert into public.lead_sources (workspace_id, label, is_system, sort_order)
values
  (null, 'Website', true, 10),
  (null, 'Referral', true, 20),
  (null, 'Social Media', true, 30),
  (null, 'Google', true, 40),
  (null, 'Returning Client', true, 50),
  (null, 'Walk-in', true, 60),
  (null, 'Event', true, 70),
  (null, 'Paid Advertisement', true, 80),
  (null, 'Partner/Professional Referral', true, 90),
  (null, 'Other', true, 100)
on conflict (workspace_id, label) do nothing;

-- =====================================================================
-- 2. Service offerings catalog ("Service" — what the firm sells),
--    distinct from Engagement Type / Service Package (engagement_type_settings)
-- =====================================================================

create table if not exists public.service_offerings (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, name)
);

comment on table public.service_offerings is
  'The firm-level catalog of what is sold (e.g. Tax Preparation, Bookkeeping). Engagement Types / Service Packages (engagement_type_settings) optionally attach to one. Feeds the Leads "Service of interest" picker.';

alter table public.service_offerings enable row level security;

drop policy if exists service_offerings_read on public.service_offerings;
create policy service_offerings_read on public.service_offerings
  for select to authenticated
  using (workspace_id is null or public.is_workspace_member(workspace_id));

drop policy if exists service_offerings_manage on public.service_offerings;
create policy service_offerings_manage on public.service_offerings
  for all to authenticated
  using (workspace_id is not null and not is_system and public.has_permission(workspace_id, 'service_offerings.manage'))
  with check (workspace_id is not null and not is_system and public.has_permission(workspace_id, 'service_offerings.manage'));

insert into public.service_offerings (workspace_id, name, is_system, sort_order)
values
  (null, 'Tax Preparation', true, 10),
  (null, 'Tax Planning', true, 20),
  (null, 'Bookkeeping', true, 30),
  (null, 'Payroll', true, 40),
  (null, 'Business Advisory', true, 50),
  (null, 'Entity Formation', true, 60),
  (null, 'Other', true, 70)
on conflict (workspace_id, name) do nothing;

alter table public.engagement_type_settings
  add column if not exists service_offering_id uuid references public.service_offerings(id) on delete set null,
  add column if not exists archived_at timestamptz,
  add column if not exists sort_order integer not null default 0;

-- Lead -> Service of interest (multi-select). Existing free-text
-- leads.service_interest is left untouched for legacy display.
create table if not exists public.lead_service_interests (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  service_offering_id uuid not null references public.service_offerings(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (lead_id, service_offering_id)
);

alter table public.lead_service_interests enable row level security;

drop policy if exists lead_service_interests_read on public.lead_service_interests;
create policy lead_service_interests_read on public.lead_service_interests
  for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id and public.is_workspace_member(l.workspace_id)));

drop policy if exists lead_service_interests_manage on public.lead_service_interests;
create policy lead_service_interests_manage on public.lead_service_interests
  for all to authenticated
  using (exists (
    select 1 from public.leads l
    where l.id = lead_id and public.has_permission(l.workspace_id, 'leads.edit')
  ))
  with check (exists (
    select 1 from public.leads l
    where l.id = lead_id and public.has_permission(l.workspace_id, 'leads.edit')
  ));

-- =====================================================================
-- 3. Engagement-creation duplicate-submission guard (idempotency key)
-- =====================================================================

alter table public.tax_engagements
  add column if not exists client_request_id uuid;

create unique index if not exists tax_engagements_client_request_id_unique
  on public.tax_engagements (workspace_id, client_request_id)
  where client_request_id is not null;

comment on column public.tax_engagements.client_request_id is
  'Frontend-generated idempotency key (one per form session). A repeated submit with the same key hits this unique index instead of creating a second engagement.';

-- =====================================================================
-- 4. Client identity vault (full SSN/EIN/ITIN, encrypted at rest)
--    No such vault existed anywhere in the prior schema — only last4
--    columns and an unpopulated fingerprint table. Built net-new here,
--    reusing pgcrypto (already installed) and Supabase Vault for the key.
-- =====================================================================

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'verexa_identity_vault_key') then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'verexa_identity_vault_key',
      'Symmetric key for encrypting client SSN/EIN/ITIN at rest (pgcrypto pgp_sym_encrypt). Generated once; never stored in application code or migrations.'
    );
  end if;
end $$;

create or replace function private.get_identity_vault_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'verexa_identity_vault_key';
$$;

revoke all on function private.get_identity_vault_key() from public, anon, authenticated;

create table if not exists private.client_identity_secrets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  identifier_type text not null check (identifier_type in ('ssn', 'ein', 'itin')),
  ciphertext bytea not null,
  last4 text not null check (last4 ~ '^[0-9]{4}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  unique (workspace_id, client_id, identifier_type)
);

comment on table private.client_identity_secrets is
  'Encrypted full SSN/EIN/ITIN values. Never selected directly by clients/frontend — only via the set/reveal SECURITY DEFINER RPCs below, which enforce permission + recent-reauthentication checks and audit every access.';

revoke all on private.client_identity_secrets from public, anon, authenticated;
grant all on private.client_identity_secrets to service_role;
alter table private.client_identity_secrets enable row level security;

create or replace function public.set_client_identity_value(
  p_workspace_id uuid,
  p_client_id uuid,
  p_identifier_type text,
  p_value text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_digits text;
  v_last4 text;
begin
  if not public.has_permission(p_workspace_id, 'clients.identity_manage') then
    raise exception 'You do not have permission to set client identifiers.' using errcode = '42501';
  end if;

  if p_identifier_type not in ('ssn', 'ein', 'itin') then
    raise exception 'Invalid identifier type.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.workspace_id = p_workspace_id) then
    raise exception 'Client not found in this workspace.' using errcode = '42501';
  end if;

  v_digits := regexp_replace(p_value, '[^0-9]', '', 'g');
  if length(v_digits) <> 9 then
    raise exception 'Enter a complete 9-digit %.', upper(p_identifier_type) using errcode = '22023';
  end if;
  v_last4 := right(v_digits, 4);

  insert into private.client_identity_secrets (workspace_id, client_id, identifier_type, ciphertext, last4, updated_by)
  values (
    p_workspace_id,
    p_client_id,
    p_identifier_type,
    extensions.pgp_sym_encrypt(v_digits, private.get_identity_vault_key()),
    v_last4,
    auth.uid()
  )
  on conflict (workspace_id, client_id, identifier_type)
  do update set ciphertext = excluded.ciphertext, last4 = excluded.last4, updated_by = auth.uid(), updated_at = now();

  update public.clients
  set ssn_last4 = case when p_identifier_type = 'ssn' then v_last4 else ssn_last4 end,
      ein_last4 = case when p_identifier_type = 'ein' then v_last4 else ein_last4 end,
      itin_last4 = case when p_identifier_type = 'itin' then v_last4 else itin_last4 end
  where id = p_client_id;

  insert into private.client_identifier_fingerprints (workspace_id, client_id, identifier_type, fingerprint, last4)
  values (p_workspace_id, p_client_id, p_identifier_type, encode(extensions.hmac(v_digits, private.get_identity_vault_key(), 'sha256'), 'hex'), v_last4)
  on conflict (workspace_id, client_id, identifier_type)
  do update set fingerprint = excluded.fingerprint, last4 = excluded.last4, updated_at = now();

  insert into public.audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, new_values)
  values (p_workspace_id, auth.uid(), 'client_identity_set', 'client', p_client_id, jsonb_build_object('identifier_type', p_identifier_type, 'last4', v_last4));
end;
$$;

revoke all on function public.set_client_identity_value(uuid, uuid, text, text) from public, anon;
grant execute on function public.set_client_identity_value(uuid, uuid, text, text) to authenticated;

-- Reveal requires the caller's JWT to show a recent authentication event
-- (auth_time within the last 120 seconds) -- i.e. they just re-entered their
-- password via signInWithPassword. This is real re-authentication, not a
-- cosmetic check: Supabase stamps a fresh auth_time on every successful
-- credential verification, and the JWT is signed server-side.
create or replace function public.reveal_client_identity_value(
  p_workspace_id uuid,
  p_client_id uuid,
  p_identifier_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_time bigint;
  v_secret record;
  v_value text;
begin
  if not public.has_permission(p_workspace_id, 'clients.identity_reveal') then
    insert into public.audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (p_workspace_id, auth.uid(), 'client_identity_reveal_denied', 'client', p_client_id, jsonb_build_object('identifier_type', p_identifier_type, 'reason', 'no_permission'));
    raise exception 'You do not have permission to reveal client identifiers.' using errcode = '42501';
  end if;

  begin
    v_auth_time := (auth.jwt() ->> 'auth_time')::bigint;
  exception when others then
    v_auth_time := null;
  end;

  if v_auth_time is null or (extract(epoch from now()) - v_auth_time) > 120 then
    insert into public.audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, new_values)
    values (p_workspace_id, auth.uid(), 'client_identity_reveal_denied', 'client', p_client_id, jsonb_build_object('identifier_type', p_identifier_type, 'reason', 'reauth_required'));
    raise exception 'Please re-enter your password to reveal this value.' using errcode = '28000';
  end if;

  select * into v_secret from private.client_identity_secrets
  where workspace_id = p_workspace_id and client_id = p_client_id and identifier_type = p_identifier_type;

  if not found then
    raise exception 'No value has been recorded for this identifier.' using errcode = 'P0002';
  end if;

  v_value := extensions.pgp_sym_decrypt(v_secret.ciphertext, private.get_identity_vault_key());

  insert into public.audit_logs (workspace_id, actor_user_id, action, entity_type, entity_id, new_values)
  values (p_workspace_id, auth.uid(), 'client_identity_revealed', 'client', p_client_id, jsonb_build_object('identifier_type', p_identifier_type, 'last4', v_secret.last4));

  return v_value;
end;
$$;

revoke all on function public.reveal_client_identity_value(uuid, uuid, text) from public, anon;
grant execute on function public.reveal_client_identity_value(uuid, uuid, text) to authenticated;

-- =====================================================================
-- 5. New granular permission definitions + role grants
-- =====================================================================

insert into public.permission_definitions (permission_key, resource, action, description, risk_level, allowed_scopes, owner_only)
values
  ('lead_sources.manage', 'lead_sources', 'manage', 'Create, edit, reorder, and archive lead source options', 'standard', array['workspace'], false),
  ('service_offerings.manage', 'service_offerings', 'manage', 'Create, edit, reorder, and archive the firm''s service catalog', 'standard', array['workspace'], false),
  ('clients.identity_manage', 'clients', 'identity_manage', 'Enter or replace a client''s full SSN/EIN/ITIN', 'high', array['workspace'], false),
  ('clients.identity_reveal', 'clients', 'identity_reveal', 'Reveal a client''s full SSN/EIN/ITIN after reauthentication', 'high', array['workspace'], false)
on conflict (permission_key) do nothing;

-- Owner + Admin: full access to all four new permissions.
insert into public.role_permissions (role_definition_id, permission_key, effect, permission_scope)
select rd.id, g.permission_key, 'allow', 'workspace'
from public.role_definitions rd
cross join (values
  ('lead_sources.manage'),
  ('service_offerings.manage'),
  ('clients.identity_manage'),
  ('clients.identity_reveal')
) as g(permission_key)
where rd.is_system and rd.role_key in ('owner', 'admin')
on conflict (role_definition_id, permission_key) do update set effect = 'allow', permission_scope = 'workspace';

-- ERO: operational catalogs (lead sources, service catalog) are consistent
-- with the ERO's existing Settings/Team/Integrations operational scope.
-- Identity reveal is deliberately NOT granted to ERO by default -- it is a
-- new, highly sensitive capability with no prior precedent to preserve;
-- an Owner/Admin can grant it explicitly later via role management.
insert into public.role_permissions (role_definition_id, permission_key, effect, permission_scope)
select rd.id, g.permission_key, 'allow', 'workspace'
from public.role_definitions rd
cross join (values
  ('lead_sources.manage'),
  ('service_offerings.manage')
) as g(permission_key)
where rd.is_system and rd.role_key = 'ero'
on conflict (role_definition_id, permission_key) do update set effect = 'allow', permission_scope = 'workspace';
