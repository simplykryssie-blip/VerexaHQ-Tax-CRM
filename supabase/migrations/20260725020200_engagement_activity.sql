-- Tax Engagement Management, part 3: broaden the existing
-- engagement_status_history table into a general engagement activity log
-- rather than creating a second, parallel activity table. It already had
-- workspace_id/engagement_id/changed_by/changed_at/metadata (renamed in
-- comments below to match this phase's vocabulary); this migration adds the
-- columns needed for non-status-change events (preparer assigned, due date
-- changed, extension flags, document/intake linked, etc.).

alter table public.engagement_status_history
  alter column to_status drop not null,
  add column if not exists activity_type text not null default 'status_changed',
  add column if not exists description text,
  add column if not exists old_value text,
  add column if not exists new_value text;

comment on table public.engagement_status_history is
  'Engagement activity/history log. Despite the table name (kept for compatibility with the existing log_engagement_status_change() trigger and RLS policies), this now records every significant engagement event via activity_type, not only status changes. changed_by is the actor (nullable for system events); changed_at is the created_at equivalent.';
comment on column public.engagement_status_history.changed_by is 'actor_user_id equivalent -- nullable for system-generated events.';
comment on column public.engagement_status_history.changed_at is 'created_at equivalent for this activity row.';
comment on column public.engagement_status_history.activity_type is 'e.g. created, status_changed, stage_changed, preparer_assigned, reviewer_assigned, due_date_changed, extension_requested, extension_filed, document_request_linked, intake_linked, submitted_for_review, review_completed, marked_filed, efile_status_changed, completed, archived, note_added, override.';
comment on column public.engagement_status_history.old_value is 'Prior value as text, when the activity represents a field change.';
comment on column public.engagement_status_history.new_value is 'New value as text, when the activity represents a field change.';

-- The existing trigger already inserts a row on every INSERT/status UPDATE;
-- extend it to also stamp activity_type/description so those rows are
-- consistent with the ones server actions insert directly for non-status
-- events.
create or replace function public.log_engagement_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.engagement_status_history
      (workspace_id, engagement_id, from_status, to_status, status_source, changed_by, changed_at, activity_type, description, old_value, new_value)
    values
      (new.workspace_id, new.id, null, new.status, new.status_source, new.created_by, now(), 'created', 'Engagement created', null, new.status::text);
  elsif new.status is distinct from old.status then
    insert into public.engagement_status_history
      (workspace_id, engagement_id, from_status, to_status, status_source, changed_by, changed_at, activity_type, description, old_value, new_value)
    values
      (new.workspace_id, new.id, old.status, new.status, new.status_source, auth.uid(), now(), 'status_changed', 'Status changed', old.status::text, new.status::text);
  end if;
  return new;
end;
$$;

-- General-purpose activity logger for server actions to call for events
-- that are not a status change on tax_engagements itself (preparer
-- assigned, due date changed, extension flags, document/intake linked,
-- note added, override used, etc.). Authorization mirrors
-- engagement_status_history's existing insert policy (can_manage_engagement).
create or replace function public.log_engagement_activity(
  p_engagement_id uuid,
  p_activity_type text,
  p_description text,
  p_old_value text default null,
  p_new_value text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_workspace_id uuid;
  v_id bigint;
begin
  select workspace_id into v_workspace_id from public.tax_engagements where id = p_engagement_id;
  if v_workspace_id is null then
    raise exception 'Engagement % not found', p_engagement_id;
  end if;

  if not public.can_manage_engagement(p_engagement_id) then
    raise exception 'Not authorized to record activity on this engagement';
  end if;

  insert into public.engagement_status_history
    (workspace_id, engagement_id, changed_by, changed_at, activity_type, description, old_value, new_value, metadata)
  values
    (v_workspace_id, p_engagement_id, auth.uid(), now(), p_activity_type, p_description, p_old_value, p_new_value, p_metadata)
  returning id into v_id;

  return v_id;
end;
$$;

comment on function public.log_engagement_activity(uuid, text, text, text, text, jsonb) is
  'Records a non-status-change engagement activity entry. Re-checks can_manage_engagement() itself rather than trusting the caller, so it is safe to expose to authenticated even though it is SECURITY DEFINER.';

revoke execute on function public.log_engagement_activity(uuid, text, text, text, text, jsonb) from public;
revoke execute on function public.log_engagement_activity(uuid, text, text, text, text, jsonb) from anon;
grant execute on function public.log_engagement_activity(uuid, text, text, text, text, jsonb) to authenticated;

revoke execute on function public.log_engagement_status_change() from public;
revoke execute on function public.log_engagement_status_change() from anon;
revoke execute on function public.log_engagement_status_change() from authenticated;
