-- Align the operational ERO permission grants with the RLS policies that
-- actually authorize team, office settings, and provider integration access.
-- Owner-only authority remains protected: EROs cannot modify Owner/Admin
-- memberships or change workspace ownership, type, or lifecycle state.

create or replace function public.protect_workspace_operational_settings()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not (
    public.has_workspace_role(old.id, array['owner','admin']::public.membership_role[])
    or public.is_platform_admin()
  ) and (
    new.id is distinct from old.id
    or new.owner_user_id is distinct from old.owner_user_id
    or new.workspace_type is distinct from old.workspace_type
    or new.status is distinct from old.status
    or new.archived_at is distinct from old.archived_at
  ) then
    raise exception 'ERO workspace settings access cannot change ownership, workspace type, or lifecycle status.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_workspace_operational_settings on public.workspaces;
create trigger protect_workspace_operational_settings
before update on public.workspaces
for each row execute function public.protect_workspace_operational_settings();

drop policy if exists workspace_members_insert_admin on public.workspace_members;
create policy workspace_members_insert_admin
on public.workspace_members
for insert
to authenticated
with check (
  (public.has_permission(workspace_id, 'team.manage') or public.is_platform_admin())
  and role <> 'owner'::public.membership_role
  and (
    public.has_workspace_role(workspace_id, array['owner','admin']::public.membership_role[])
    or public.is_platform_admin()
    or role <> 'admin'::public.membership_role
  )
);

drop policy if exists workspace_members_update_admin on public.workspace_members;
create policy workspace_members_update_admin
on public.workspace_members
for update
to authenticated
using (
  (public.has_permission(workspace_id, 'team.manage') or public.is_platform_admin())
  and (
    role <> 'owner'::public.membership_role
    or public.has_workspace_role(workspace_id, array['owner']::public.membership_role[])
    or public.is_platform_admin()
  )
  and (
    role <> 'admin'::public.membership_role
    or public.has_workspace_role(workspace_id, array['owner','admin']::public.membership_role[])
    or public.is_platform_admin()
  )
)
with check (
  (public.has_permission(workspace_id, 'team.manage') or public.is_platform_admin())
  and (
    role <> 'owner'::public.membership_role
    or public.has_workspace_role(workspace_id, array['owner']::public.membership_role[])
    or public.is_platform_admin()
  )
  and (
    role <> 'admin'::public.membership_role
    or public.has_workspace_role(workspace_id, array['owner','admin']::public.membership_role[])
    or public.is_platform_admin()
  )
);

drop policy if exists workspace_members_delete_admin on public.workspace_members;
create policy workspace_members_delete_admin
on public.workspace_members
for delete
to authenticated
using (
  (public.has_permission(workspace_id, 'team.manage') or public.is_platform_admin())
  and (
    role <> 'owner'::public.membership_role
    or public.has_workspace_role(workspace_id, array['owner']::public.membership_role[])
    or public.is_platform_admin()
  )
  and (
    role <> 'admin'::public.membership_role
    or public.has_workspace_role(workspace_id, array['owner','admin']::public.membership_role[])
    or public.is_platform_admin()
  )
);

drop policy if exists workspaces_update_admin on public.workspaces;
create policy workspaces_update_admin
on public.workspaces
for update
to authenticated
using (public.has_permission(id, 'settings.manage') or public.is_platform_admin())
with check (public.has_permission(id, 'settings.manage') or public.is_platform_admin());

drop policy if exists workspace_integrations_admin_all on public.workspace_integrations;
create policy workspace_integrations_admin_all
on public.workspace_integrations
for all
to authenticated
using (public.has_permission(workspace_id, 'integrations.manage') or public.is_platform_admin())
with check (public.has_permission(workspace_id, 'integrations.manage') or public.is_platform_admin());

drop policy if exists integration_health_checks_admin_select on public.integration_health_checks;
create policy integration_health_checks_admin_select
on public.integration_health_checks
for select
to authenticated
using (public.has_permission(workspace_id, 'integrations.manage') or public.is_platform_admin());
