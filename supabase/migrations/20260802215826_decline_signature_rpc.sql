-- Additive: complete_signature only ever records "signed" -- there was no
-- server-side path for a signer to decline. This mirrors its auth/locking
-- pattern but sets status='declined' instead, and never touches signed_at
-- or signature_data (a decline is not a signature).
create or replace function public.decline_signature(
  p_signer_id uuid,
  p_decline_reason text,
  p_ip_address inet default null,
  p_user_agent text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare v_signer public.signature_signers%rowtype; v_request public.signature_requests%rowtype;
begin
  select * into v_signer from public.signature_signers where id = p_signer_id for update;
  if not found then raise exception 'Signer not found'; end if;
  if v_signer.user_id is distinct from auth.uid() and not public.is_workspace_member(v_signer.workspace_id) then
    raise exception 'Not authorized';
  end if;
  if v_signer.status = 'signed' then
    return jsonb_build_object('status', 'already_signed');
  end if;
  if v_signer.status = 'declined' then
    return jsonb_build_object('status', 'already_declined');
  end if;

  select * into v_request from public.signature_requests where id = v_signer.signature_request_id for update;

  update public.signature_signers
  set status = 'declined', declined_at = now(), decline_reason = p_decline_reason, ip_address = p_ip_address, user_agent = p_user_agent, updated_at = now()
  where id = p_signer_id;

  insert into public.signature_events(workspace_id, signature_request_id, signer_id, event_type, actor_user_id, actor_email, ip_address, user_agent, evidence)
  values (v_signer.workspace_id, v_signer.signature_request_id, p_signer_id, 'declined', auth.uid(), v_signer.email, p_ip_address, p_user_agent, jsonb_build_object('decline_reason', p_decline_reason));

  update public.signature_requests set status = 'declined', updated_at = now() where id = v_request.id;

  return jsonb_build_object('status', 'declined');
end;
$$;

revoke all on function public.decline_signature(uuid, text, inet, text) from public;
grant execute on function public.decline_signature(uuid, text, inet, text) to authenticated, service_role;
