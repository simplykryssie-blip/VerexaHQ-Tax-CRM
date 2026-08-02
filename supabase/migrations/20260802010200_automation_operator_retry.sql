-- Section 8: a permission-checked operator retry contract for failed jobs.
create or replace function public.retry_automation_job(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_job public.automation_jobs%rowtype;
begin
  select * into v_job from public.automation_jobs where id = p_job_id for update;
  if not found then raise exception 'Automation job not found.'; end if;
  if auth.uid() is null or not public.has_permission(v_job.workspace_id, 'automation.retry') then
    raise exception 'You do not have permission to retry automation jobs.';
  end if;
  if v_job.status not in ('failed', 'cancelled') then raise exception 'Only failed or cancelled jobs can be retried.'; end if;
  update public.automation_jobs set status = 'queued', scheduled_for = now(), attempt_count = 0,
    failed_at = null, completed_at = null, last_error = null, locked_at = null,
    locked_by = null, updated_at = now(), result = '{}'::jsonb where id = p_job_id;
  return p_job_id;
end;
$$;

create or replace function public.retry_workflow_action(p_action_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_action public.workflow_action_outbox%rowtype;
begin
  select * into v_action from public.workflow_action_outbox where id = p_action_id for update;
  if not found then raise exception 'Workflow action not found.'; end if;
  if auth.uid() is null or not public.has_permission(v_action.workspace_id, 'automation.retry') then
    raise exception 'You do not have permission to retry workflow actions.';
  end if;
  if v_action.status not in ('failed', 'cancelled') then raise exception 'Only failed or cancelled workflow actions can be retried.'; end if;
  update public.workflow_action_outbox set status = 'queued', scheduled_for = now(), processed_at = null, error_message = null where id = p_action_id;
  return p_action_id;
end;
$$;

revoke execute on function public.retry_automation_job(uuid) from public, anon;
grant execute on function public.retry_automation_job(uuid) to authenticated, service_role;
revoke execute on function public.retry_workflow_action(uuid) from public, anon;
grant execute on function public.retry_workflow_action(uuid) to authenticated, service_role;

