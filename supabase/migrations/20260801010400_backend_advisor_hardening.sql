-- Addresses advisor findings from the backend workflow migration: indexes all
-- foreign keys, removes overlapping SELECT policies, and narrows RPC grants.

begin;

-- Add a covering index for every foreign key in the new backend tables.
do $$
declare v record; v_columns text; v_index_name text;
begin
  for v in
    select c.oid,c.conrelid,c.conname,c.conkey
    from pg_constraint c
    where c.contype='f' and c.conrelid in (
      'public.engagement_type_settings'::regclass,
      'public.workflow_stages'::regclass,
      'public.workflow_stage_transitions'::regclass,
      'public.engagement_workflow_instances'::regclass,
      'public.engagement_workflow_stage_instances'::regclass,
      'public.engagement_progress_trackers'::regclass,
      'public.engagement_deadlines'::regclass,
      'public.lead_forms'::regclass,
      'public.lead_form_submissions'::regclass,
      'public.pricing_assessments'::regclass,
      'public.pricing_rules'::regclass,
      'public.client_quotes'::regclass
    )
    and not exists (
      select 1 from pg_index i where i.indrelid=c.conrelid and i.indisvalid
        and (i.indkey::smallint[])[0:cardinality(c.conkey)-1] @> c.conkey
    )
  loop
    select string_agg(quote_ident(a.attname),',' order by u.ord)
    into v_columns
    from unnest(v.conkey) with ordinality u(attnum,ord)
    join pg_attribute a on a.attrelid=v.conrelid and a.attnum=u.attnum;
    v_index_name := left(replace(v.conrelid::regclass::text,'public.','')||'_'||replace(v_columns,'"','')||'_fk_idx',63);
    execute format('create index if not exists %I on %s (%s)',v_index_name,v.conrelid::regclass,v_columns);
  end loop;
end;
$$;

-- A FOR ALL policy also applies to SELECT and overlapped each read policy.
-- Split management into INSERT/UPDATE/DELETE policies so reads stay singular.
do $$
declare v record;
begin
  for v in select * from (values
    ('engagement_type_settings','engagement_type_settings_manage',
      '(public.has_workspace_role(workspace_id, array[''owner'',''admin'',''ero'']::public.membership_role[]) or public.is_platform_admin())'),
    ('workflow_stages','workflow_stages_manage','public.can_manage_workflow_definition(workflow_definition_id)'),
    ('workflow_stage_transitions','workflow_stage_transitions_manage','public.can_manage_workflow_definition(workflow_definition_id)'),
    ('engagement_workflow_instances','engagement_workflow_instances_manage','(public.can_manage_engagement(engagement_id) or public.is_platform_admin())'),
    ('engagement_workflow_stage_instances','engagement_workflow_stage_instances_manage',
      '(exists (select 1 from public.engagement_workflow_instances i where i.id=workflow_instance_id and public.can_manage_engagement(i.engagement_id)) or public.is_platform_admin())'),
    ('engagement_progress_trackers','engagement_progress_trackers_manage','(public.can_manage_engagement(engagement_id) or public.is_platform_admin())'),
    ('engagement_deadlines','engagement_deadlines_manage','(public.can_manage_engagement(engagement_id) or public.is_platform_admin())'),
    ('lead_forms','lead_forms_manage',
      '(public.has_workspace_role(workspace_id, array[''owner'',''admin'',''ero'',''preparer'']::public.membership_role[]) or public.is_platform_admin())'),
    ('lead_form_submissions','lead_form_submissions_manage',
      '(public.has_workspace_role(workspace_id, array[''owner'',''admin'',''ero'',''preparer'',''intake_specialist'']::public.membership_role[]) or public.is_platform_admin())'),
    ('pricing_assessments','pricing_assessments_manage',
      '(public.has_workspace_role(workspace_id, array[''owner'',''admin'',''ero'',''preparer'',''intake_specialist'']::public.membership_role[]) or public.is_platform_admin())'),
    ('pricing_rules','pricing_rules_manage',
      '(public.has_workspace_role(workspace_id, array[''owner'',''admin'',''ero'']::public.membership_role[]) or public.is_platform_admin())'),
    ('client_quotes','client_quotes_manage',
      '(public.has_workspace_role(workspace_id, array[''owner'',''admin'',''ero'',''preparer'',''billing'']::public.membership_role[]) or public.is_platform_admin())'),
    ('tax_jurisdiction_rule_profiles','tax_jurisdiction_rule_profiles_platform_manage','public.is_platform_admin()')
  ) x(table_name,old_policy,predicate)
  loop
    execute format('drop policy if exists %I on public.%I',v.old_policy,v.table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s)',v.table_name||'_insert',v.table_name,v.predicate);
    execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)',v.table_name||'_update',v.table_name,v.predicate,v.predicate);
    execute format('create policy %I on public.%I for delete to authenticated using (%s)',v.table_name||'_delete',v.table_name,v.predicate);
  end loop;
end;
$$;

-- This RPC can operate entirely through the caller's existing RLS rights.
alter function public.set_engagement_workflow_stage(uuid,text,text) security invoker;

-- Public lead submission is anonymous by design. Signed-in staff do not need
-- this RPC; they use the staff lead creation flow instead.
revoke execute on function public.submit_public_lead_form(text,jsonb,boolean,text) from authenticated;
grant execute on function public.submit_public_lead_form(text,jsonb,boolean,text) to anon,service_role;

comment on function public.submit_public_lead_form(text,jsonb,boolean,text) is
  'Intentional anonymous SECURITY DEFINER boundary. Direct anon table grants are revoked; the function validates consent, payload size, honeypot, active form/version, contact data, and prohibited sensitive keys.';
comment on function public.find_possible_duplicate_clients(uuid,text,text,text) is
  'Intentional authenticated SECURITY DEFINER boundary. It verifies workspace membership before reading private HMAC identifier fingerprints and returns only masked identifying data.';

commit;
