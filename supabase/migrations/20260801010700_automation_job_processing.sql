-- Reliable claim/retry/dead-letter contracts for backend automation jobs.

begin;

alter table public.automation_jobs
  add column if not exists idempotency_key text,
  add column if not exists result jsonb not null default '{}'::jsonb;

alter table public.reminders
  add column if not exists idempotency_key text;

create unique index if not exists automation_jobs_workspace_idempotency_idx
  on public.automation_jobs(workspace_id,idempotency_key)
  where idempotency_key is not null;
create unique index if not exists reminders_workspace_idempotency_idx
  on public.reminders(workspace_id,idempotency_key)
  where idempotency_key is not null;

create or replace function private.set_automation_job_idempotency()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.idempotency_key is null and new.job_type='deliver_engagement_activation_package'
     and new.payload ? 'activation_id' then
    new.idempotency_key:='engagement_activation:'||(new.payload->>'activation_id');
  end if;
  return new;
end;
$$;

revoke all on function private.set_automation_job_idempotency() from public,anon,authenticated;

drop trigger if exists automation_jobs_set_idempotency on public.automation_jobs;
create trigger automation_jobs_set_idempotency
before insert or update of job_type,payload,idempotency_key on public.automation_jobs
for each row execute function private.set_automation_job_idempotency();

update public.automation_jobs
set idempotency_key='engagement_activation:'||(payload->>'activation_id')
where job_type='deliver_engagement_activation_package'
  and payload ? 'activation_id' and idempotency_key is null;

create or replace function public.claim_due_automation_jobs(
  p_worker_id text,
  p_limit integer default 25
)
returns setof public.automation_jobs
language sql
security definer
set search_path = ''
as $$
  update public.automation_jobs j
  set status='processing',attempt_count=j.attempt_count+1,locked_at=now(),
      locked_by=left(coalesce(nullif(btrim(p_worker_id),''),'unknown-worker'),200),
      last_error=null,updated_at=now()
  where j.id in (
    select id from public.automation_jobs
    where scheduled_for<=now() and attempt_count<max_attempts
      and (
        status='queued'
        or (status='processing' and locked_at<now()-interval '15 minutes')
      )
    order by scheduled_for,created_at
    for update skip locked
    limit greatest(1,least(p_limit,100))
  )
  returning j.*;
$$;

create or replace function public.complete_automation_job(
  p_job_id uuid,
  p_worker_id text,
  p_result jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.automation_jobs set
    status='completed',completed_at=now(),failed_at=null,last_error=null,
    locked_at=null,locked_by=null,result=coalesce(p_result,'{}'::jsonb),updated_at=now()
  where id=p_job_id and status='processing' and locked_by=p_worker_id;
  return found;
end;
$$;

create or replace function public.fail_automation_job(
  p_job_id uuid,
  p_worker_id text,
  p_error text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare v_job public.automation_jobs%rowtype;
begin
  select * into v_job from public.automation_jobs
  where id=p_job_id and status='processing' and locked_by=p_worker_id for update;
  if not found then return 'not_owned'; end if;

  if v_job.attempt_count>=v_job.max_attempts then
    update public.automation_jobs set status='failed',failed_at=now(),
      last_error=left(coalesce(p_error,'Unknown automation error'),4000),
      locked_at=null,locked_by=null,updated_at=now() where id=v_job.id;
    return 'failed';
  end if;

  update public.automation_jobs set status='queued',
    scheduled_for=now()+make_interval(secs=>least(3600,30*power(2,greatest(v_job.attempt_count-1,0))::int)),
    last_error=left(coalesce(p_error,'Unknown automation error'),4000),
    locked_at=null,locked_by=null,updated_at=now() where id=v_job.id;
  return 'retry_scheduled';
end;
$$;

revoke all on function public.claim_due_automation_jobs(text,integer) from public,anon,authenticated;
revoke all on function public.complete_automation_job(uuid,text,jsonb) from public,anon,authenticated;
revoke all on function public.fail_automation_job(uuid,text,text) from public,anon,authenticated;
grant execute on function public.claim_due_automation_jobs(text,integer) to service_role;
grant execute on function public.complete_automation_job(uuid,text,jsonb) to service_role;
grant execute on function public.fail_automation_job(uuid,text,text) to service_role;

comment on function public.claim_due_automation_jobs(text,integer) is
  'Service-role-only SKIP LOCKED queue claim with stale-lock recovery.';
comment on function public.complete_automation_job(uuid,text,jsonb) is
  'Service-role-only completion contract; only the worker holding the job lock may complete it.';
comment on function public.fail_automation_job(uuid,text,text) is
  'Service-role-only exponential retry/dead-letter contract; only the worker holding the job lock may fail it.';

commit;
