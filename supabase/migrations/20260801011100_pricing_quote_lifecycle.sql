-- Section 2: authoritative pricing and quote lifecycle contracts.

insert into public.permission_definitions(permission_key,resource,action,description,risk_level,allowed_scopes,owner_only) values
('pricing.view','pricing','view','View pricing assessments and rules','sensitive',array['assigned','team','workspace'],false),
('pricing.assess','pricing','assess','Create, calculate, and review pricing assessments','sensitive',array['assigned','team','workspace'],false),
('pricing.rules','pricing','rules','Manage rule-based pricing configuration','high',array['workspace'],false),
('quotes.view','quotes','view','View client quotes','sensitive',array['assigned','team','workspace'],false),
('quotes.create','quotes','create','Create draft quotes and change orders','high',array['assigned','team','workspace'],false),
('quotes.edit','quotes','edit','Edit draft quotes and change orders','high',array['assigned','team','workspace'],false),
('quotes.send','quotes','send','Send, expire, or supersede quotes','high',array['assigned','team','workspace'],false)
on conflict (permission_key) do update set
  description=excluded.description,risk_level=excluded.risk_level,
  allowed_scopes=excluded.allowed_scopes,owner_only=excluded.owner_only;

with grants(role_key,permission_key,permission_scope) as (values
  ('owner','pricing.view','workspace'),('owner','pricing.assess','workspace'),('owner','pricing.rules','workspace'),('owner','quotes.view','workspace'),('owner','quotes.create','workspace'),('owner','quotes.edit','workspace'),('owner','quotes.send','workspace'),
  ('admin','pricing.view','workspace'),('admin','pricing.assess','workspace'),('admin','pricing.rules','workspace'),('admin','quotes.view','workspace'),('admin','quotes.create','workspace'),('admin','quotes.edit','workspace'),('admin','quotes.send','workspace'),
  ('ero','pricing.view','workspace'),('ero','pricing.assess','workspace'),('ero','pricing.rules','workspace'),('ero','quotes.view','workspace'),('ero','quotes.create','workspace'),('ero','quotes.edit','workspace'),('ero','quotes.send','workspace'),
  ('preparer','pricing.view','assigned'),('preparer','pricing.assess','assigned'),('preparer','quotes.view','assigned'),('preparer','quotes.create','assigned'),('preparer','quotes.edit','assigned'),
  ('intake_specialist','pricing.view','assigned'),('intake_specialist','pricing.assess','assigned'),('intake_specialist','quotes.view','assigned'),
  ('billing','pricing.view','workspace'),('billing','pricing.assess','workspace'),('billing','quotes.view','workspace'),('billing','quotes.create','workspace'),('billing','quotes.edit','workspace'),('billing','quotes.send','workspace'),
  ('auditor','pricing.view','workspace'),('auditor','quotes.view','workspace')
)
insert into public.role_permissions(role_definition_id,permission_key,effect,permission_scope)
select rd.id,g.permission_key,'allow',g.permission_scope
from grants g join public.role_definitions rd on rd.is_system and rd.role_key=g.role_key
on conflict (role_definition_id,permission_key) do update set effect='allow',permission_scope=excluded.permission_scope;

create or replace function public.next_quote_number(p_workspace_id uuid)
returns text
language plpgsql
security definer
set search_path=''
as $$
declare v_prefix text:='Q-'||extract(year from current_date)::int||'-'; v_next integer;
begin
  if auth.uid() is null or not public.has_permission(p_workspace_id,'quotes.create') then
    raise exception 'Permission denied';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('quote:'||p_workspace_id::text,0));
  select coalesce(max(substring(quote_number from '[0-9]+$')::integer),0)+1 into v_next
  from public.client_quotes where workspace_id=p_workspace_id and quote_number like v_prefix||'%';
  return v_prefix||lpad(v_next::text,4,'0');
end;
$$;

create or replace function private.protect_accepted_quote()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if old.status in ('accepted','declined','expired','superseded') and row(new.*) is distinct from row(old.*) then
    raise exception 'Finalized quotes are immutable. Create a change order instead.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_accepted_quote on public.client_quotes;
create trigger protect_accepted_quote before update on public.client_quotes
for each row execute function private.protect_accepted_quote();

create or replace function public.send_client_quote(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_quote public.client_quotes%rowtype;
begin
  select * into v_quote from public.client_quotes where id=p_quote_id for update;
  if not found then raise exception 'Quote not found'; end if;
  if auth.uid() is null or not public.has_permission(v_quote.workspace_id,'quotes.send',jsonb_build_object('created_by',v_quote.created_by)) then raise exception 'Permission denied'; end if;
  if v_quote.status not in ('draft','sent') then raise exception 'Only a draft or sent quote can be sent'; end if;
  if coalesce(v_quote.amount,v_quote.amount_min,v_quote.amount_max) is null then raise exception 'Quote amount is required'; end if;
  update public.client_quotes set status='sent',sent_at=coalesce(sent_at,now()) where id=p_quote_id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,new_values)
  values(v_quote.workspace_id,auth.uid(),'quote.sent','client_quote',p_quote_id,jsonb_build_object('quote_number',v_quote.quote_number));
  return jsonb_build_object('quote_id',p_quote_id,'status','sent','sent_at',now());
end;
$$;

create or replace function public.expire_client_quote(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_quote public.client_quotes%rowtype;
begin
  select * into v_quote from public.client_quotes where id=p_quote_id for update;
  if not found then raise exception 'Quote not found'; end if;
  if auth.uid() is null or not public.has_permission(v_quote.workspace_id,'quotes.send',jsonb_build_object('created_by',v_quote.created_by)) then raise exception 'Permission denied'; end if;
  if v_quote.status not in ('draft','sent','viewed') then raise exception 'This quote can no longer be expired'; end if;
  update public.client_quotes set status='expired' where id=p_quote_id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,new_values)
  values(v_quote.workspace_id,auth.uid(),'quote.expired','client_quote',p_quote_id,jsonb_build_object('quote_number',v_quote.quote_number));
  return jsonb_build_object('quote_id',p_quote_id,'status','expired');
end;
$$;

create or replace function public.accept_client_quote(p_quote_id uuid,p_accepted_by_name text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_quote public.client_quotes%rowtype; v_client_allowed boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select q.* into v_quote from public.client_quotes q where q.id=p_quote_id for update;
  if not found then raise exception 'Quote not found'; end if;
  select exists(select 1 from public.clients c where c.id=v_quote.client_id and (
    c.portal_user_id=auth.uid() or exists(select 1 from public.client_contacts cc where cc.client_id=c.id and cc.auth_user_id=auth.uid() and cc.can_access_portal and cc.is_active)
  )) into v_client_allowed;
  if not v_client_allowed then raise exception 'Quote not found'; end if;
  if v_quote.status not in ('sent','viewed') then raise exception 'This quote is not available for acceptance'; end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    update public.client_quotes set status='expired' where id=p_quote_id;
    raise exception 'This quote has expired';
  end if;
  if length(btrim(coalesce(p_accepted_by_name,''))) < 2 then raise exception 'Enter the accepting person''s full name'; end if;
  update public.client_quotes set status='accepted',accepted_at=now(),accepted_by_name=btrim(p_accepted_by_name) where id=p_quote_id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,new_values)
  values(v_quote.workspace_id,auth.uid(),'quote.accepted','client_quote',p_quote_id,jsonb_build_object('quote_number',v_quote.quote_number,'accepted_by_name',btrim(p_accepted_by_name)));
  return jsonb_build_object('quote_id',p_quote_id,'status','accepted','accepted_at',now());
end;
$$;

create or replace function public.decline_client_quote(p_quote_id uuid,p_accepted_by_name text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_quote public.client_quotes%rowtype; v_client_allowed boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select q.* into v_quote from public.client_quotes q where q.id=p_quote_id for update;
  if not found then raise exception 'Quote not found'; end if;
  select exists(select 1 from public.clients c where c.id=v_quote.client_id and (
    c.portal_user_id=auth.uid() or exists(select 1 from public.client_contacts cc where cc.client_id=c.id and cc.auth_user_id=auth.uid() and cc.can_access_portal and cc.is_active)
  )) into v_client_allowed;
  if not v_client_allowed then raise exception 'Quote not found'; end if;
  if v_quote.status not in ('sent','viewed') then raise exception 'This quote is not available'; end if;
  update public.client_quotes set status='declined',accepted_by_name=nullif(btrim(coalesce(p_accepted_by_name,'')),'') where id=p_quote_id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,new_values)
  values(v_quote.workspace_id,auth.uid(),'quote.declined','client_quote',p_quote_id,jsonb_build_object('quote_number',v_quote.quote_number));
  return jsonb_build_object('quote_id',p_quote_id,'status','declined');
end;
$$;

create policy client_quotes_portal_select on public.client_quotes for select to authenticated
using (exists(select 1 from public.clients c where c.id=client_quotes.client_id and (
  c.portal_user_id=auth.uid() or exists(select 1 from public.client_contacts cc where cc.client_id=c.id and cc.auth_user_id=auth.uid() and cc.can_access_portal and cc.is_active)
)));

revoke all on function public.next_quote_number(uuid) from public,anon;
revoke all on function public.send_client_quote(uuid) from public,anon;
revoke all on function public.expire_client_quote(uuid) from public,anon;
revoke all on function public.accept_client_quote(uuid,text) from public,anon;
revoke all on function public.decline_client_quote(uuid,text) from public,anon;
grant execute on function public.next_quote_number(uuid),public.send_client_quote(uuid),public.expire_client_quote(uuid),public.accept_client_quote(uuid,text),public.decline_client_quote(uuid,text) to authenticated,service_role;

comment on function public.accept_client_quote(uuid,text) is 'Portal-only quote acceptance. Verifies the signed-in user is linked to the quote client and writes an audit event.';
