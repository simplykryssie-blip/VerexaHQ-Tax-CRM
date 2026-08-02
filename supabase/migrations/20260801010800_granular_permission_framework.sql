-- Granular, server-enforced permissions for the Verexa Tax Office frontend.
-- UI visibility mirrors these results; this database contract remains authoritative.

create table public.permission_definitions (
  permission_key text primary key check (permission_key ~ '^[a-z_]+\.[a-z_]+$'),
  resource text not null,
  action text not null,
  description text not null,
  risk_level text not null default 'standard' check (risk_level in ('standard','sensitive','high')),
  allowed_scopes text[] not null default array['workspace']::text[],
  owner_only boolean not null default false,
  created_at timestamptz not null default now(),
  unique(resource, action)
);

create table public.role_definitions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references public.workspaces(id) on delete cascade,
  role_key text not null,
  name text not null,
  description text,
  system_role public.membership_role,
  is_system boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((is_system and workspace_id is null and system_role is not null) or (not is_system and workspace_id is not null)),
  unique nulls not distinct (workspace_id, role_key)
);

create table public.role_permissions (
  role_definition_id uuid not null references public.role_definitions(id) on delete cascade,
  permission_key text not null references public.permission_definitions(permission_key) on delete cascade,
  effect text not null default 'allow' check (effect in ('allow','deny')),
  permission_scope text not null default 'workspace' check (permission_scope in ('assigned','team','workspace')),
  created_at timestamptz not null default now(),
  primary key (role_definition_id, permission_key)
);

create table public.member_role_assignments (
  membership_id uuid primary key references public.workspace_members(id) on delete cascade,
  role_definition_id uuid not null references public.role_definitions(id) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now()
);

create table public.sensitive_action_approvals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  permission_key text not null references public.permission_definitions(permission_key),
  entity_type text not null,
  entity_id text,
  reason text not null check (length(btrim(reason)) >= 8),
  requested_by uuid not null references auth.users(id),
  approved_by uuid references auth.users(id),
  status text not null default 'pending' check (status in ('pending','approved','denied','expired','cancelled')),
  expires_at timestamptz,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.record_retention_controls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  legal_hold boolean not null default false,
  retain_until date,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  released_by uuid references auth.users(id) on delete set null,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(workspace_id, entity_type, entity_id)
);

insert into public.permission_definitions(permission_key,resource,action,description,risk_level,allowed_scopes,owner_only) values
('dashboard.view','dashboard','view','View workspace dashboard','standard',array['assigned','team','workspace'],false),
('clients.view','clients','view','View client records','sensitive',array['assigned','team','workspace'],false),
('clients.create','clients','create','Create client records','sensitive',array['workspace'],false),
('clients.edit','clients','edit','Edit client records','sensitive',array['assigned','team','workspace'],false),
('engagements.view','engagements','view','View tax engagements','sensitive',array['assigned','team','workspace'],false),
('engagements.create','engagements','create','Create draft engagements','sensitive',array['assigned','team','workspace'],false),
('engagements.activate','engagements','activate','Activate an engagement package','high',array['assigned','team','workspace'],false),
('engagements.assign','engagements','assign','Assign preparers and reviewers','high',array['team','workspace'],false),
('engagements.release','engagements','release','Release a completed return','high',array['assigned','team','workspace'],false),
('intakes.view','intakes','view','View intake organizers','sensitive',array['assigned','team','workspace'],false),
('documents.view','documents','view','View documents and requests','sensitive',array['assigned','team','workspace'],false),
('tasks.view','tasks','view','View staff tasks','standard',array['assigned','team','workspace'],false),
('reviews.view','reviews','view','View review queues','sensitive',array['assigned','team','workspace'],false),
('reviews.approve','reviews','approve','Approve tax work under review','high',array['assigned','team','workspace'],false),
('service_packages.view','service_packages','view','View service packages','standard',array['workspace'],false),
('service_packages.create','service_packages','create','Create service packages','high',array['workspace'],false),
('service_packages.edit','service_packages','edit','Edit future engagement defaults','high',array['workspace'],false),
('service_packages.duplicate','service_packages','duplicate','Duplicate service packages','standard',array['workspace'],false),
('service_packages.deactivate','service_packages','deactivate','Deactivate service packages','high',array['workspace'],false),
('service_packages.archive','service_packages','archive','Archive service packages','high',array['workspace'],false),
('templates.manage','templates','manage','Create, version, publish, and archive templates','high',array['workspace'],false),
('workflows.manage','workflows','manage','Create, version, publish, and archive workflows','high',array['workspace'],false),
('communications.view','communications','view','View communication history','sensitive',array['assigned','team','workspace'],false),
('billing.manage','billing','manage','Manage quotes, invoices, and payments','high',array['assigned','team','workspace'],false),
('reports.view','reports','view','View office reports','sensitive',array['assigned','team','workspace'],false),
('team.manage','team','manage','Manage team membership','high',array['workspace'],false),
('settings.manage','settings','manage','Manage office settings','high',array['workspace'],false),
('permissions.manage','permissions','manage','Manage custom roles and permissions','high',array['workspace'],true),
('audit.view','audit','view','View audit events','sensitive',array['workspace'],false),
('integrations.manage','integrations','manage','Manage provider integrations','high',array['workspace'],false),
('subscription.manage','subscription','manage','Manage subscription and billing owner','high',array['workspace'],true)
on conflict (permission_key) do update set description=excluded.description,risk_level=excluded.risk_level,allowed_scopes=excluded.allowed_scopes,owner_only=excluded.owner_only;

insert into public.role_definitions(role_key,name,description,system_role,is_system)
select r::text, initcap(replace(r::text,'_',' ')), 'Verexa system role', r, true
from unnest(enum_range(null::public.membership_role)) r
on conflict (workspace_id,role_key) do nothing;

with grants(role_key, permission_key, permission_scope) as (values
('owner','*','workspace'),('admin','*','workspace'),
('ero','dashboard.view','workspace'),('ero','clients.view','workspace'),('ero','clients.create','workspace'),('ero','clients.edit','workspace'),('ero','engagements.view','workspace'),('ero','engagements.create','workspace'),('ero','engagements.activate','workspace'),('ero','engagements.assign','workspace'),('ero','engagements.release','workspace'),('ero','intakes.view','workspace'),('ero','documents.view','workspace'),('ero','tasks.view','workspace'),('ero','reviews.view','workspace'),('ero','reviews.approve','workspace'),('ero','service_packages.view','workspace'),('ero','communications.view','workspace'),('ero','reports.view','workspace'),('ero','audit.view','workspace'),
('preparer','dashboard.view','assigned'),('preparer','clients.view','assigned'),('preparer','clients.edit','assigned'),('preparer','engagements.view','assigned'),('preparer','engagements.create','assigned'),('preparer','engagements.activate','assigned'),('preparer','intakes.view','assigned'),('preparer','documents.view','assigned'),('preparer','tasks.view','assigned'),('preparer','communications.view','assigned'),('preparer','reports.view','assigned'),
('reviewer','dashboard.view','workspace'),('reviewer','clients.view','workspace'),('reviewer','engagements.view','workspace'),('reviewer','intakes.view','workspace'),('reviewer','documents.view','workspace'),('reviewer','tasks.view','assigned'),('reviewer','reviews.view','workspace'),('reviewer','reviews.approve','workspace'),('reviewer','communications.view','assigned'),('reviewer','reports.view','workspace'),
('intake_specialist','dashboard.view','assigned'),('intake_specialist','clients.view','assigned'),('intake_specialist','clients.edit','assigned'),('intake_specialist','engagements.view','assigned'),('intake_specialist','intakes.view','assigned'),('intake_specialist','documents.view','assigned'),('intake_specialist','tasks.view','assigned'),('intake_specialist','communications.view','assigned'),
('document_specialist','dashboard.view','assigned'),('document_specialist','clients.view','assigned'),('document_specialist','engagements.view','assigned'),('document_specialist','intakes.view','assigned'),('document_specialist','documents.view','assigned'),('document_specialist','tasks.view','assigned'),('document_specialist','communications.view','assigned'),
('billing','dashboard.view','workspace'),('billing','clients.view','workspace'),('billing','engagements.view','workspace'),('billing','billing.manage','workspace'),('billing','communications.view','workspace'),('billing','reports.view','workspace'),
('seasonal_staff','dashboard.view','assigned'),('seasonal_staff','clients.view','assigned'),('seasonal_staff','engagements.view','assigned'),('seasonal_staff','intakes.view','assigned'),('seasonal_staff','documents.view','assigned'),('seasonal_staff','tasks.view','assigned'),
('auditor','dashboard.view','workspace'),('auditor','clients.view','workspace'),('auditor','engagements.view','workspace'),('auditor','intakes.view','workspace'),('auditor','documents.view','workspace'),('auditor','reviews.view','workspace'),('auditor','communications.view','workspace'),('auditor','reports.view','workspace'),('auditor','audit.view','workspace')
)
insert into public.role_permissions(role_definition_id,permission_key,effect,permission_scope)
select rd.id,p.permission_key,'allow',g.permission_scope
from grants g join public.role_definitions rd on rd.is_system and rd.role_key=g.role_key
join public.permission_definitions p on g.permission_key='*' or p.permission_key=g.permission_key
where not (p.owner_only and g.role_key <> 'owner')
on conflict (role_definition_id,permission_key) do update set effect=excluded.effect,permission_scope=excluded.permission_scope;

create or replace function public.get_my_permissions(p_workspace_id uuid)
returns table(permission_key text, allowed boolean, permission_scope text, denial_reason text)
language sql stable security definer set search_path=public
as $$
  with membership as (
    select wm.id,wm.role from public.workspace_members wm
    where wm.workspace_id=p_workspace_id and wm.user_id=auth.uid() and wm.status='active'
  ), selected_role as (
    select coalesce(custom.id,system.id) id
    from membership m
    left join public.member_role_assignments a on a.membership_id=m.id
    left join public.role_definitions custom on custom.id=a.role_definition_id and custom.workspace_id=p_workspace_id and custom.is_active
    join public.role_definitions system on system.is_system and system.system_role=m.role
  )
  select p.permission_key,
         coalesce(rp.effect='allow',false) allowed,
         coalesce(rp.permission_scope,'workspace') permission_scope,
         case when rp.permission_key is null then 'Your role does not include this permission.' when rp.effect='deny' then 'This permission is explicitly denied.' else null end denial_reason
  from public.permission_definitions p
  left join selected_role sr on true
  left join public.role_permissions rp on rp.role_definition_id=sr.id and rp.permission_key=p.permission_key
  order by p.permission_key;
$$;

create or replace function public.check_permission(p_workspace_id uuid,p_permission_key text,p_record_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path=public
as $$
declare v_allowed boolean:=false; v_scope text:='workspace'; v_reason text; v_user uuid:=auth.uid();
begin
  if v_user is null then return jsonb_build_object('allowed',false,'scope',null,'reason','Authentication required.'); end if;
  select g.allowed,g.permission_scope,g.denial_reason into v_allowed,v_scope,v_reason from public.get_my_permissions(p_workspace_id) g where g.permission_key=p_permission_key;
  if not coalesce(v_allowed,false) then return jsonb_build_object('allowed',false,'scope',v_scope,'reason',coalesce(v_reason,'Permission is not defined.')); end if;
  if v_scope='assigned' and p_record_context <> '{}'::jsonb and not (
    p_record_context->>'assigned_user_id'=v_user::text or
    coalesce(p_record_context->'assigned_user_ids','[]'::jsonb) ? v_user::text or
    p_record_context->>'created_by'=v_user::text
  ) then return jsonb_build_object('allowed',false,'scope',v_scope,'reason','This record is outside your assigned scope.'); end if;
  return jsonb_build_object('allowed',true,'scope',v_scope,'reason',null);
end $$;

create or replace function public.has_permission(p_workspace_id uuid,p_permission_key text,p_record_context jsonb default '{}'::jsonb)
returns boolean language sql stable security definer set search_path=public
as $$ select coalesce((public.check_permission(p_workspace_id,p_permission_key,p_record_context)->>'allowed')::boolean,false) $$;

revoke all on function public.get_my_permissions(uuid) from public,anon;
revoke all on function public.check_permission(uuid,text,jsonb) from public,anon;
revoke all on function public.has_permission(uuid,text,jsonb) from public,anon;
grant execute on function public.get_my_permissions(uuid) to authenticated,service_role;
grant execute on function public.check_permission(uuid,text,jsonb) to authenticated,service_role;
grant execute on function public.has_permission(uuid,text,jsonb) to authenticated,service_role;

alter table public.permission_definitions enable row level security;
alter table public.role_definitions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.member_role_assignments enable row level security;
alter table public.sensitive_action_approvals enable row level security;
alter table public.record_retention_controls enable row level security;

create policy permission_definitions_read on public.permission_definitions for select to authenticated using (true);
create policy role_definitions_read on public.role_definitions for select to authenticated using (is_system or public.is_workspace_member(workspace_id));
create policy role_definitions_manage on public.role_definitions for all to authenticated using (workspace_id is not null and public.has_workspace_role(workspace_id,array['owner','admin']::public.membership_role[])) with check (workspace_id is not null and public.has_workspace_role(workspace_id,array['owner','admin']::public.membership_role[]));
create policy role_permissions_read on public.role_permissions for select to authenticated using (exists(select 1 from public.role_definitions r where r.id=role_definition_id and (r.is_system or public.is_workspace_member(r.workspace_id))));
create policy role_permissions_manage on public.role_permissions for all to authenticated using (exists(select 1 from public.role_definitions r where r.id=role_definition_id and r.workspace_id is not null and public.has_workspace_role(r.workspace_id,array['owner','admin']::public.membership_role[]))) with check (exists(select 1 from public.role_definitions r where r.id=role_definition_id and r.workspace_id is not null and public.has_workspace_role(r.workspace_id,array['owner','admin']::public.membership_role[])));
create policy member_role_assignments_read on public.member_role_assignments for select to authenticated using (exists(select 1 from public.workspace_members wm where wm.id=membership_id and public.is_workspace_member(wm.workspace_id)));
create policy member_role_assignments_manage on public.member_role_assignments for all to authenticated using (exists(select 1 from public.workspace_members wm where wm.id=membership_id and public.has_workspace_role(wm.workspace_id,array['owner','admin']::public.membership_role[]))) with check (exists(select 1 from public.workspace_members wm join public.role_definitions rd on rd.id=role_definition_id where wm.id=membership_id and rd.workspace_id=wm.workspace_id and public.has_workspace_role(wm.workspace_id,array['owner','admin']::public.membership_role[])));
create policy sensitive_action_approvals_read on public.sensitive_action_approvals for select to authenticated using (public.is_workspace_member(workspace_id));
create policy sensitive_action_approvals_create on public.sensitive_action_approvals for insert to authenticated with check (public.is_workspace_member(workspace_id) and requested_by=auth.uid());
create policy sensitive_action_approvals_decide on public.sensitive_action_approvals for update to authenticated using (public.has_workspace_role(workspace_id,array['owner','admin']::public.membership_role[])) with check (public.has_workspace_role(workspace_id,array['owner','admin']::public.membership_role[]));
create policy retention_read on public.record_retention_controls for select to authenticated using (public.has_workspace_role(workspace_id,array['owner','admin','auditor']::public.membership_role[]));
create policy retention_manage on public.record_retention_controls for all to authenticated using (public.has_workspace_role(workspace_id,array['owner']::public.membership_role[])) with check (public.has_workspace_role(workspace_id,array['owner']::public.membership_role[]));

grant select on public.permission_definitions,public.role_definitions,public.role_permissions,public.member_role_assignments,public.sensitive_action_approvals,public.record_retention_controls to authenticated;
grant insert,update,delete on public.role_definitions,public.role_permissions,public.member_role_assignments,public.sensitive_action_approvals,public.record_retention_controls to authenticated;

create trigger role_definitions_updated_at before update on public.role_definitions for each row execute function public.set_updated_at();
create trigger record_retention_controls_updated_at before update on public.record_retention_controls for each row execute function public.set_updated_at();

comment on function public.check_permission(uuid,text,jsonb) is 'Authoritative permission evaluator returning allowed, scope, and denial reason for the signed-in user.';
