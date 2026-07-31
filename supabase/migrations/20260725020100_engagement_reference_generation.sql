-- Tax Engagement Management, part 2: concurrency-safe, workspace-scoped
-- human-readable engagement reference generation (e.g. TX-2025-000123).
--
-- Uses a per-workspace/tax-year counter table with an atomic
-- INSERT ... ON CONFLICT DO UPDATE, which Postgres guarantees is race-free
-- under concurrent transactions (the row lock taken by the upsert serializes
-- concurrent callers) -- this avoids the classic unsafe "select max(n)+1"
-- pattern. A BEFORE INSERT trigger assigns the reference automatically so
-- application code never has to generate or guess it.

create table public.engagement_reference_sequences (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  tax_year smallint not null,
  last_number integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (workspace_id, tax_year)
);

comment on table public.engagement_reference_sequences is
  'One row per workspace+tax_year holding the last-issued engagement reference number. Incremented atomically by assign_engagement_number(); never read with a plain select max().';

alter table public.engagement_reference_sequences enable row level security;

-- Staff can read the counters for their own workspace (informational only;
-- all real access goes through the trigger function as SECURITY DEFINER).
-- No insert/update policy: only the trigger function (running as its
-- definer) ever writes to this table.
create policy "engagement_reference_sequences_staff_read"
on public.engagement_reference_sequences
for select
to public
using (public.is_workspace_member(workspace_id) or public.is_platform_admin());

create or replace function public.next_engagement_reference(p_workspace_id uuid, p_tax_year smallint)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_next integer;
begin
  insert into public.engagement_reference_sequences as s (workspace_id, tax_year, last_number, updated_at)
  values (p_workspace_id, p_tax_year, 1, now())
  on conflict (workspace_id, tax_year)
  do update set last_number = s.last_number + 1, updated_at = now()
  returning last_number into v_next;

  return 'TX-' || p_tax_year::text || '-' || lpad(v_next::text, 6, '0');
end;
$$;

comment on function public.next_engagement_reference(uuid, smallint) is
  'Atomically issues the next TX-<year>-NNNNNN reference for a workspace/tax_year pair via INSERT ... ON CONFLICT DO UPDATE (row-lock serialized, not a select-max race).';

create or replace function public.assign_engagement_number()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.engagement_number is null then
    new.engagement_number := public.next_engagement_reference(
      new.workspace_id,
      coalesce(new.tax_year, extract(year from now())::smallint)
    );
  end if;
  return new;
end;
$$;

comment on function public.assign_engagement_number() is
  'BEFORE INSERT trigger on tax_engagements: fills engagement_number automatically when the application leaves it null. Stable after creation -- never reassigned on update.';

create trigger assign_engagement_number_trigger
  before insert on public.tax_engagements
  for each row
  execute function public.assign_engagement_number();

-- Enforce uniqueness within a workspace now that the column is populated by
-- the trigger going forward.
create unique index if not exists idx_tax_engagements_workspace_reference_unique
  on public.tax_engagements(workspace_id, engagement_number);

-- Neither function is called directly by application code (the app inserts
-- into tax_engagements with engagement_number left null; the trigger and
-- its SECURITY DEFINER context handle the rest), so no role other than the
-- function owner needs EXECUTE.
revoke execute on function public.next_engagement_reference(uuid, smallint) from public;
revoke execute on function public.next_engagement_reference(uuid, smallint) from anon;
revoke execute on function public.next_engagement_reference(uuid, smallint) from authenticated;

revoke execute on function public.assign_engagement_number() from public;
revoke execute on function public.assign_engagement_number() from anon;
revoke execute on function public.assign_engagement_number() from authenticated;
