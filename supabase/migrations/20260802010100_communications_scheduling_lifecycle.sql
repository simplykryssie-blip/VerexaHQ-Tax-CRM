-- Section 5: permission-aware communication scheduling, consent enforcement,
-- failed-delivery retry, and response-aware reminder cancellation.

create or replace function public.queue_communication(
  p_workspace_id uuid,
  p_channel public.outbox_channel,
  p_recipient text,
  p_subject text default null,
  p_body_text text default null,
  p_body_html text default null,
  p_client_id uuid default null,
  p_engagement_id uuid default null,
  p_scheduled_for timestamptz default now(),
  p_metadata jsonb default '{}'::jsonb,
  p_idempotency_key text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_provider public.integration_provider;
  v_preferences public.client_communication_preferences%rowtype;
begin
  if auth.uid() is null or not public.has_permission(p_workspace_id, 'communications.send') then
    raise exception 'You do not have permission to send communications.';
  end if;

  if nullif(btrim(p_recipient), '') is null then
    raise exception 'A recipient address is required.';
  end if;

  if p_client_id is not null then
    if not exists (
      select 1 from public.clients c
      where c.id = p_client_id and c.workspace_id = p_workspace_id and c.archived_at is null
    ) then
      raise exception 'Client not found in this workspace.';
    end if;

    select * into v_preferences
    from public.client_communication_preferences
    where workspace_id = p_workspace_id and client_id = p_client_id;

    if p_channel = 'email' and found and
       (not v_preferences.email_consent or v_preferences.email_suppressed or v_preferences.invalid_email) then
      raise exception 'Email is disabled for this client by their communication preferences.';
    end if;
    if p_channel = 'sms' and (not found or not v_preferences.sms_consent or v_preferences.sms_suppressed or v_preferences.invalid_phone) then
      raise exception 'SMS is disabled for this client by their communication preferences.';
    end if;
  end if;

  v_provider := case p_channel
    when 'sms' then 'twilio'::public.integration_provider
    when 'email' then 'resend'::public.integration_provider
    else null
  end;

  insert into public.communication_outbox(
    workspace_id, channel, recipient_address, subject, body_text, body_html,
    client_id, engagement_id, scheduled_for, metadata, idempotency_key,
    provider, created_by
  ) values (
    p_workspace_id, p_channel, btrim(p_recipient), nullif(btrim(p_subject), ''),
    nullif(btrim(p_body_text), ''), p_body_html, p_client_id, p_engagement_id,
    greatest(coalesce(p_scheduled_for, now()), now()), coalesce(p_metadata, '{}'::jsonb),
    p_idempotency_key, v_provider, auth.uid()
  )
  on conflict (workspace_id, idempotency_key) do update set updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.retry_communication(p_outbox_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.communication_outbox%rowtype;
begin
  select * into v_row from public.communication_outbox where id = p_outbox_id for update;
  if not found then raise exception 'Communication not found.'; end if;
  if auth.uid() is null or not public.has_permission(v_row.workspace_id, 'communications.send') then
    raise exception 'You do not have permission to retry communications.';
  end if;
  if v_row.status not in ('failed', 'cancelled') then
    raise exception 'Only failed or cancelled communications can be retried.';
  end if;

  update public.communication_outbox
  set status = 'queued', scheduled_for = now(), attempt_count = 0,
      error_message = null, failed_at = null, last_attempt_at = null,
      provider_message_id = null, sent_at = null, delivered_at = null,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('retried_by', auth.uid(), 'retried_at', now()),
      updated_at = now()
  where id = p_outbox_id;
  return p_outbox_id;
end;
$$;

create or replace function public.stop_reminders_on_client_response()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_client_id uuid;
begin
  if new.sender_type <> 'client' then return new; end if;
  select c.client_id into v_client_id from public.conversations c where c.id = new.conversation_id;
  update public.reminders
  set status = 'cancelled', skipped_reason = 'Client responded', updated_at = now()
  where workspace_id = new.workspace_id
    and client_id = v_client_id
    and status = 'scheduled'
    and coalesce((payload ->> 'stop_on_client_response')::boolean, false) = true;
  return new;
end;
$$;

drop trigger if exists stop_reminders_on_client_response_trigger on public.messages;
create trigger stop_reminders_on_client_response_trigger
after insert on public.messages
for each row execute function public.stop_reminders_on_client_response();

revoke execute on function public.queue_communication(uuid, public.outbox_channel, text, text, text, text, uuid, uuid, timestamptz, jsonb, text) from public, anon;
grant execute on function public.queue_communication(uuid, public.outbox_channel, text, text, text, text, uuid, uuid, timestamptz, jsonb, text) to authenticated, service_role;
revoke execute on function public.retry_communication(uuid) from public, anon;
grant execute on function public.retry_communication(uuid) to authenticated, service_role;
revoke execute on function public.stop_reminders_on_client_response() from public, anon, authenticated;
grant execute on function public.stop_reminders_on_client_response() to postgres, service_role;

