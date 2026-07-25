-- Allow a client portal user (primary taxpayer or an active, portal-enabled
-- client contact) to read the workspace record of the tax office that
-- serves them, so the portal can show the office name/branding. Staff
-- access to workspaces is unchanged (workspaces_select_member).
drop policy if exists "workspaces_client_portal_access" on public.workspaces;

create policy "workspaces_client_portal_access"
on public.workspaces
for select
to public
using (
  exists (
    select 1
    from public.clients c
    where c.workspace_id = workspaces.id
      and (
        c.portal_user_id = auth.uid()
        or exists (
          select 1
          from public.client_contacts cc
          where cc.client_id = c.id
            and cc.auth_user_id = auth.uid()
            and cc.can_access_portal = true
            and cc.is_active = true
        )
      )
  )
);
