-- Correction pass: lead-to-client conversion did not transfer the lead's
-- email/phone into a client_contacts row, so the Contact Information tab
-- showed nothing for a freshly converted lead even though clients.email/
-- clients.phone were populated. This create-or-replace reproduces the
-- existing convert_lead_to_client_v2 body verbatim (same signature, same
-- permission checks, same duplicate handling) and adds exactly one
-- additional insert, only on the "new client" path (never when linking to
-- an existing client, so existing client data is never overwritten).

create or replace function public.convert_lead_to_client_v2(
  p_lead_id uuid,
  p_client_type public.client_type default 'individual',
  p_existing_client_id uuid default null,
  p_duplicate_override_reason text default null
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_lead public.leads%rowtype; v_client public.clients%rowtype; v_duplicates uuid[]; v_reason text:=nullif(btrim(coalesce(p_duplicate_override_reason,'')),'');
begin
  select * into v_lead from public.leads where id=p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if auth.uid() is null or not public.has_permission(v_lead.workspace_id,'leads.convert',jsonb_build_object('assigned_user_id',v_lead.assigned_user_id,'created_by',v_lead.created_by)) then raise exception 'Permission denied'; end if;
  if v_lead.converted_client_id is not null then return jsonb_build_object('client_id',v_lead.converted_client_id,'created',false,'already_converted',true); end if;
  if p_client_type not in ('individual','business') then raise exception 'Only Individual or Business client records can be created'; end if;

  select array_agg(c.id) into v_duplicates from public.clients c
  where c.workspace_id=v_lead.workspace_id and c.archived_at is null and (
    (v_lead.email is not null and lower(btrim(c.email))=lower(btrim(v_lead.email))) or
    (v_lead.phone is not null and regexp_replace(c.phone,'[^0-9]','','g')=regexp_replace(v_lead.phone,'[^0-9]','','g'))
  );

  if p_existing_client_id is not null then
    select * into v_client from public.clients where id=p_existing_client_id and workspace_id=v_lead.workspace_id for update;
    if not found then raise exception 'Selected client was not found'; end if;
  else
    if coalesce(array_length(v_duplicates,1),0)>0 then
      if v_reason is null then raise exception 'Possible duplicate client found. Open the existing file or provide an override reason.'; end if;
      if length(v_reason)<8 then raise exception 'Duplicate override reason must be at least 8 characters'; end if;
      if not public.has_permission(v_lead.workspace_id,'clients.duplicate_override') then raise exception 'You do not have permission to override duplicate warnings'; end if;
    end if;
    insert into public.clients(workspace_id,first_name,last_name,email,phone,company,client_type,status,notes,source,assigned_user_id,created_by,display_name)
    values(v_lead.workspace_id,v_lead.first_name,v_lead.last_name,v_lead.email,v_lead.phone,v_lead.company,p_client_type,'active',v_lead.notes,v_lead.source,v_lead.assigned_user_id,auth.uid(),trim(concat_ws(' ',v_lead.first_name,v_lead.last_name)))
    returning * into v_client;

    -- New correction-pass behavior: transfer the lead's contact details onto
    -- the new client as its primary contact. Only on the brand-new-client
    -- path -- an existing client's contacts are never touched.
    if v_lead.email is not null or v_lead.phone is not null then
      insert into public.client_contacts(workspace_id,client_id,contact_type,first_name,last_name,email,phone,is_primary)
      values(v_lead.workspace_id,v_client.id,'personal',v_lead.first_name,v_lead.last_name,v_lead.email,v_lead.phone,true);
    end if;
  end if;

  update public.leads set converted_client_id=v_client.id,converted_at=now(),status='won',updated_at=now() where id=v_lead.id;
  update public.client_quotes set client_id=v_client.id where lead_id=v_lead.id and client_id is null;
  update public.pricing_assessments set client_id=v_client.id where lead_id=v_lead.id and client_id is null;
  update public.lead_form_submissions set status='converted',reviewed_at=coalesce(reviewed_at,now()),reviewed_by=coalesce(reviewed_by,auth.uid()) where lead_id=v_lead.id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,new_values)
  values(v_lead.workspace_id,auth.uid(),case when p_existing_client_id is null then 'lead.converted' else 'lead.linked_existing_client' end,'lead',v_lead.id,
    jsonb_build_object('client_id',v_client.id,'duplicate_matches',coalesce(to_jsonb(v_duplicates),'[]'::jsonb),'override_reason',v_reason));
  return jsonb_build_object('client_id',v_client.id,'created',p_existing_client_id is null,'already_converted',false);
end $$;

revoke all on function public.convert_lead_to_client_v2(uuid,public.client_type,uuid,text) from public,anon;
grant execute on function public.convert_lead_to_client_v2(uuid,public.client_type,uuid,text) to authenticated,service_role;
comment on function public.convert_lead_to_client_v2(uuid,public.client_type,uuid,text) is 'Idempotent lead conversion with masked duplicate workflow, optional existing-client link, related quote/assessment transfer, primary-contact transfer on new clients, and audit logging.';
