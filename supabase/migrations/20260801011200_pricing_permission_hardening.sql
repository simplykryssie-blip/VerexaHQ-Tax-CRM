-- Make granular permissions authoritative for pricing records and prevent
-- delivery of a lead-only quote before it is attached to a portal client.

drop policy if exists pricing_assessments_select on public.pricing_assessments;
drop policy if exists pricing_assessments_manage on public.pricing_assessments;
drop policy if exists pricing_assessments_insert on public.pricing_assessments;
drop policy if exists pricing_assessments_update on public.pricing_assessments;
drop policy if exists pricing_assessments_delete on public.pricing_assessments;
create policy pricing_assessments_select on public.pricing_assessments for select to authenticated
using (public.has_permission(workspace_id,'pricing.view',jsonb_build_object('created_by',created_by)) or public.is_platform_admin());
create policy pricing_assessments_insert on public.pricing_assessments for insert to authenticated
with check (public.has_permission(workspace_id,'pricing.assess',jsonb_build_object('created_by',created_by)) or public.is_platform_admin());
create policy pricing_assessments_update on public.pricing_assessments for update to authenticated
using (public.has_permission(workspace_id,'pricing.assess',jsonb_build_object('created_by',created_by)) or public.is_platform_admin())
with check (public.has_permission(workspace_id,'pricing.assess',jsonb_build_object('created_by',created_by)) or public.is_platform_admin());

drop policy if exists pricing_rules_select on public.pricing_rules;
drop policy if exists pricing_rules_manage on public.pricing_rules;
drop policy if exists pricing_rules_insert on public.pricing_rules;
drop policy if exists pricing_rules_update on public.pricing_rules;
drop policy if exists pricing_rules_delete on public.pricing_rules;
create policy pricing_rules_select on public.pricing_rules for select to authenticated
using (public.has_permission(workspace_id,'pricing.view') or public.is_platform_admin());
create policy pricing_rules_insert on public.pricing_rules for insert to authenticated
with check (public.has_permission(workspace_id,'pricing.rules') or public.is_platform_admin());
create policy pricing_rules_update on public.pricing_rules for update to authenticated
using (public.has_permission(workspace_id,'pricing.rules') or public.is_platform_admin())
with check (public.has_permission(workspace_id,'pricing.rules') or public.is_platform_admin());

drop policy if exists client_quotes_select on public.client_quotes;
drop policy if exists client_quotes_manage on public.client_quotes;
drop policy if exists client_quotes_insert on public.client_quotes;
drop policy if exists client_quotes_update on public.client_quotes;
drop policy if exists client_quotes_delete on public.client_quotes;
create policy client_quotes_staff_select on public.client_quotes for select to authenticated
using (public.has_permission(workspace_id,'quotes.view',jsonb_build_object('created_by',created_by)) or public.is_platform_admin());
create policy client_quotes_staff_insert on public.client_quotes for insert to authenticated
with check (public.has_permission(workspace_id,'quotes.create',jsonb_build_object('created_by',created_by)) or public.is_platform_admin());
create policy client_quotes_staff_update on public.client_quotes for update to authenticated
using (public.has_permission(workspace_id,'quotes.edit',jsonb_build_object('created_by',created_by)) or public.is_platform_admin())
with check (public.has_permission(workspace_id,'quotes.edit',jsonb_build_object('created_by',created_by)) or public.is_platform_admin());

create or replace function public.send_client_quote(p_quote_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_quote public.client_quotes%rowtype;
begin
  select * into v_quote from public.client_quotes where id=p_quote_id for update;
  if not found then raise exception 'Quote not found'; end if;
  if auth.uid() is null or not public.has_permission(v_quote.workspace_id,'quotes.send',jsonb_build_object('created_by',v_quote.created_by)) then raise exception 'Permission denied'; end if;
  if v_quote.status not in ('draft','sent') then raise exception 'Only a draft or sent quote can be sent'; end if;
  if v_quote.client_id is null then raise exception 'Convert or attach the lead to a client before sending the quote'; end if;
  if coalesce(v_quote.amount,v_quote.amount_min,v_quote.amount_max) is null then raise exception 'Quote amount is required'; end if;
  update public.client_quotes set status='sent',sent_at=coalesce(sent_at,now()) where id=p_quote_id;
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,new_values)
  values(v_quote.workspace_id,auth.uid(),'quote.sent','client_quote',p_quote_id,jsonb_build_object('quote_number',v_quote.quote_number));
  return jsonb_build_object('quote_id',p_quote_id,'status','sent','sent_at',now());
end;
$$;

revoke all on function public.send_client_quote(uuid) from public,anon;
grant execute on function public.send_client_quote(uuid) to authenticated,service_role;
