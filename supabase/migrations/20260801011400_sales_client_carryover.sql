-- Sales/client carryover: granular permissions, lead lifecycle, safe conversion,
-- public form reads, duplicate overrides, and accepted-quote change orders.

insert into public.permission_definitions(permission_key,resource,action,description,risk_level,allowed_scopes,owner_only) values
('leads.view','leads','view','View leads and pipeline','sensitive',array['assigned','team','workspace'],false),
('leads.create','leads','create','Create leads','sensitive',array['assigned','team','workspace'],false),
('leads.edit','leads','edit','Edit leads and move pipeline stages','sensitive',array['assigned','team','workspace'],false),
('leads.convert','leads','convert','Convert or link a lead to a client','high',array['assigned','team','workspace'],false),
('lead_forms.manage','lead_forms','manage','Create and edit public lead forms','high',array['workspace'],false),
('lead_forms.publish','lead_forms','publish','Publish, pause, and archive public lead forms','high',array['workspace'],false),
('clients.duplicate_override','clients','duplicate_override','Create a client after acknowledging a duplicate warning','high',array['workspace'],false),
('households.manage','households','manage','Create and manage household relationship groups','sensitive',array['assigned','team','workspace'],false),
('quotes.change_order','quotes','change_order','Create a change order from an accepted quote','high',array['assigned','team','workspace'],false)
on conflict (permission_key) do update set description=excluded.description,risk_level=excluded.risk_level,allowed_scopes=excluded.allowed_scopes,owner_only=excluded.owner_only;

with grants(role_key,permission_key,permission_scope) as (values
  ('owner','leads.view','workspace'),('owner','leads.create','workspace'),('owner','leads.edit','workspace'),('owner','leads.convert','workspace'),('owner','lead_forms.manage','workspace'),('owner','lead_forms.publish','workspace'),('owner','clients.duplicate_override','workspace'),('owner','households.manage','workspace'),('owner','quotes.change_order','workspace'),
  ('admin','leads.view','workspace'),('admin','leads.create','workspace'),('admin','leads.edit','workspace'),('admin','leads.convert','workspace'),('admin','lead_forms.manage','workspace'),('admin','lead_forms.publish','workspace'),('admin','clients.duplicate_override','workspace'),('admin','households.manage','workspace'),('admin','quotes.change_order','workspace'),
  ('ero','leads.view','workspace'),('ero','leads.create','workspace'),('ero','leads.edit','workspace'),('ero','leads.convert','workspace'),('ero','lead_forms.manage','workspace'),('ero','lead_forms.publish','workspace'),('ero','clients.duplicate_override','workspace'),('ero','households.manage','workspace'),('ero','quotes.change_order','workspace'),
  ('preparer','leads.view','assigned'),('preparer','leads.create','assigned'),('preparer','leads.edit','assigned'),('preparer','leads.convert','assigned'),('preparer','households.manage','assigned'),('preparer','quotes.change_order','assigned'),
  ('intake_specialist','leads.view','assigned'),('intake_specialist','leads.create','assigned'),('intake_specialist','leads.edit','assigned'),('intake_specialist','leads.convert','assigned'),('intake_specialist','households.manage','assigned'),
  ('billing','leads.view','workspace'),('billing','quotes.change_order','workspace'),
  ('auditor','leads.view','workspace')
)
insert into public.role_permissions(role_definition_id,permission_key,effect,permission_scope)
select rd.id,g.permission_key,'allow',g.permission_scope
from grants g join public.role_definitions rd on rd.is_system and rd.role_key=g.role_key
on conflict (role_definition_id,permission_key) do update set effect='allow',permission_scope=excluded.permission_scope;

create or replace function public.set_lead_stage(p_lead_id uuid,p_status public.lead_status,p_reason text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_lead public.leads%rowtype;
begin
  select * into v_lead from public.leads where id=p_lead_id for update;
  if not found then raise exception 'Lead not found'; end if;
  if auth.uid() is null or not public.has_permission(v_lead.workspace_id,'leads.edit',jsonb_build_object('assigned_user_id',v_lead.assigned_user_id,'created_by',v_lead.created_by)) then raise exception 'Permission denied'; end if;
  if p_status in ('lost','do_not_contact') and length(btrim(coalesce(p_reason,''))) < 3 then raise exception 'A reason is required for this stage'; end if;
  if v_lead.converted_client_id is not null and p_status <> 'won' then raise exception 'A converted lead must remain Won'; end if;
  update public.leads set status=p_status,lost_reason=case when p_status='lost' then btrim(p_reason) else null end,updated_at=now() where id=p_lead_id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,old_values,new_values)
  values(v_lead.workspace_id,auth.uid(),'lead.stage_changed','lead',p_lead_id,jsonb_build_object('status',v_lead.status),jsonb_build_object('status',p_status,'reason',p_reason));
  return p_lead_id;
end $$;

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

create or replace function public.get_public_lead_form(p_public_slug text)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'name',f.name,'public_slug',f.public_slug,'confirmation_message',f.confirmation_message,
    'consent_text',f.consent_text,'fields',coalesce(f.embed_settings->'fields','[]'::jsonb),
    'heading',coalesce(f.embed_settings->>'heading',f.name),'description',coalesce(f.embed_settings->>'description',''),
    'accent_color',coalesce(f.embed_settings->>'accent_color','#0f766e')
  ) from public.lead_forms f where f.public_slug=p_public_slug and f.status='published' and f.published_version_id is not null;
$$;

create or replace function public.set_lead_form_status(p_form_id uuid,p_status text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_form public.lead_forms%rowtype;
begin
  if p_status not in ('draft','published','paused','archived') then raise exception 'Invalid lead form status'; end if;
  select * into v_form from public.lead_forms where id=p_form_id for update;
  if not found then raise exception 'Lead form not found'; end if;
  if auth.uid() is null or not public.has_permission(v_form.workspace_id,'lead_forms.publish') then raise exception 'Permission denied'; end if;
  if p_status='published' and v_form.published_version_id is null then raise exception 'Publish a form template version before publishing this form'; end if;
  update public.lead_forms set status=p_status,updated_at=now() where id=p_form_id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,old_values,new_values)
  values(v_form.workspace_id,auth.uid(),'lead_form.status_changed','lead_form',p_form_id,jsonb_build_object('status',v_form.status),jsonb_build_object('status',p_status));
  return p_form_id;
end $$;

create or replace function public.create_quote_change_order(p_quote_id uuid,p_description text,p_amount numeric,p_valid_until date default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_quote public.client_quotes%rowtype; v_id uuid; v_number text;
begin
  select * into v_quote from public.client_quotes where id=p_quote_id for update;
  if not found then raise exception 'Quote not found'; end if;
  if v_quote.status <> 'accepted' then raise exception 'Change orders can only be created from an accepted quote'; end if;
  if auth.uid() is null or not public.has_permission(v_quote.workspace_id,'quotes.change_order',jsonb_build_object('created_by',v_quote.created_by)) then raise exception 'Permission denied'; end if;
  if length(btrim(coalesce(p_description,'')))<3 then raise exception 'Describe the additional scope'; end if;
  if p_amount is null or p_amount<0 then raise exception 'Enter a valid change-order amount'; end if;
  if exists(select 1 from public.client_quotes where supersedes_quote_id=p_quote_id and quote_type='change_order' and status in ('draft','sent','viewed')) then raise exception 'An open change order already exists for this quote'; end if;
  v_number:=public.next_quote_number(v_quote.workspace_id);
  insert into public.client_quotes(workspace_id,lead_id,client_id,engagement_id,quote_number,quote_type,pricing_method,amount,line_items,status,disclaimer,valid_until,supersedes_quote_id,created_by)
  values(v_quote.workspace_id,v_quote.lead_id,v_quote.client_id,v_quote.engagement_id,v_number,'change_order','fixed',p_amount,jsonb_build_array(jsonb_build_object('description',btrim(p_description),'quantity',1,'amount',p_amount)),'draft',v_quote.disclaimer,p_valid_until,p_quote_id,auth.uid())
  returning id into v_id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,new_values)
  values(v_quote.workspace_id,auth.uid(),'quote.change_order_created','client_quote',v_id,jsonb_build_object('supersedes_quote_id',p_quote_id,'quote_number',v_number,'amount',p_amount));
  return v_id;
end $$;

revoke all on function public.set_lead_stage(uuid,public.lead_status,text) from public,anon;
revoke all on function public.convert_lead_to_client_v2(uuid,public.client_type,uuid,text) from public,anon;
revoke all on function public.get_public_lead_form(text) from public;
revoke all on function public.set_lead_form_status(uuid,text) from public,anon;
revoke all on function public.create_quote_change_order(uuid,text,numeric,date) from public,anon;
grant execute on function public.set_lead_stage(uuid,public.lead_status,text),public.convert_lead_to_client_v2(uuid,public.client_type,uuid,text),public.set_lead_form_status(uuid,text),public.create_quote_change_order(uuid,text,numeric,date) to authenticated,service_role;
grant execute on function public.get_public_lead_form(text) to anon,authenticated,service_role;

comment on function public.convert_lead_to_client_v2(uuid,public.client_type,uuid,text) is 'Idempotent lead conversion with masked duplicate workflow, optional existing-client link, related quote/assessment transfer, and audit logging.';
comment on function public.get_public_lead_form(text) is 'Returns only the safe presentation contract for an intentionally published public lead form.';
