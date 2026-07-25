-- Full-schema RLS remediation: replace every remaining broad/anon-callable
-- policy on tax-office business tables with narrow, ownership-scoped
-- policies. Anonymous (anon) callers must never have direct CRUD on
-- business data; access is staff (workspace-membership/role) or portal
-- (client_id ownership via clients.portal_user_id / client_contacts) only.
--
-- This migration is idempotent: every policy is dropped by exact name
-- before being recreated, so re-running it is a no-op once applied.

-- ---------------------------------------------------------------------
-- workspaces: drop the legacy broad anon policy. Legitimate read access
-- is already covered by workspaces_select_member (staff) and
-- workspaces_client_portal_access (portal clients); no replacement needed.
-- ---------------------------------------------------------------------
drop policy if exists "anon_crud_workspaces" on public.workspaces;

-- ---------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------
drop policy if exists "anon_crud_services" on public.services;

drop policy if exists "services_staff_manage" on public.services;
create policy "services_staff_manage"
on public.services
for all
to public
using (
  public.has_workspace_role(workspace_id, array['owner','admin','ero','preparer']::membership_role[])
  or public.is_platform_admin()
)
with check (
  public.has_workspace_role(workspace_id, array['owner','admin','ero','preparer']::membership_role[])
  or public.is_platform_admin()
);

drop policy if exists "services_workspace_access" on public.services;
create policy "services_workspace_access"
on public.services
for select
to public
using (
  public.is_workspace_member(workspace_id)
  or (
    client_id is not null
    and exists (
      select 1
      from public.clients c
      where c.id = services.client_id
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
  )
  or public.is_platform_admin()
);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
drop policy if exists "anon_crud_notifications" on public.notifications;

drop policy if exists "notifications_staff_manage" on public.notifications;
create policy "notifications_staff_manage"
on public.notifications
for all
to public
using (
  (workspace_id is not null and public.is_workspace_member(workspace_id))
  or public.is_platform_admin()
)
with check (
  (workspace_id is not null and public.is_workspace_member(workspace_id))
  or public.is_platform_admin()
);

drop policy if exists "notifications_access" on public.notifications;
create policy "notifications_access"
on public.notifications
for select
to public
using (
  (workspace_id is not null and public.is_workspace_member(workspace_id))
  or (
    client_id is not null
    and exists (
      select 1
      from public.clients c
      where c.id = notifications.client_id
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
  )
  or public.is_platform_admin()
);

-- ---------------------------------------------------------------------
-- form_templates
-- ---------------------------------------------------------------------
drop policy if exists "anon_crud_form_templates" on public.form_templates;

drop policy if exists "form_templates_staff_manage" on public.form_templates;
create policy "form_templates_staff_manage"
on public.form_templates
for all
to public
using (
  public.has_workspace_role(workspace_id, array['owner','admin','ero','preparer']::membership_role[])
  or public.is_platform_admin()
)
with check (
  public.has_workspace_role(workspace_id, array['owner','admin','ero','preparer']::membership_role[])
  or public.is_platform_admin()
);

drop policy if exists "form_templates_access" on public.form_templates;
create policy "form_templates_access"
on public.form_templates
for select
to public
using (
  public.is_workspace_member(workspace_id)
  or exists (
    select 1
    from public.client_form_assignments cfa
    join public.clients c on c.id = cfa.client_id
    where cfa.template_id = form_templates.id
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
  or public.is_platform_admin()
);

-- ---------------------------------------------------------------------
-- form_questions
-- ---------------------------------------------------------------------
drop policy if exists "anon_crud_form_questions" on public.form_questions;

drop policy if exists "form_questions_staff_manage" on public.form_questions;
create policy "form_questions_staff_manage"
on public.form_questions
for all
to public
using (
  exists (
    select 1
    from public.form_templates ft
    where ft.id = form_questions.template_id
      and public.has_workspace_role(ft.workspace_id, array['owner','admin','ero','preparer']::membership_role[])
  )
  or public.is_platform_admin()
)
with check (
  exists (
    select 1
    from public.form_templates ft
    where ft.id = form_questions.template_id
      and public.has_workspace_role(ft.workspace_id, array['owner','admin','ero','preparer']::membership_role[])
  )
  or public.is_platform_admin()
);

drop policy if exists "form_questions_access" on public.form_questions;
create policy "form_questions_access"
on public.form_questions
for select
to public
using (
  exists (
    select 1
    from public.form_templates ft
    where ft.id = form_questions.template_id
      and public.is_workspace_member(ft.workspace_id)
  )
  or (
    is_staff_only = false
    and exists (
      select 1
      from public.client_form_assignments cfa
      join public.clients c on c.id = cfa.client_id
      where cfa.template_id = form_questions.template_id
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
  )
  or public.is_platform_admin()
);

-- ---------------------------------------------------------------------
-- form_response_answers
-- ---------------------------------------------------------------------
drop policy if exists "anon_crud_form_response_answers" on public.form_response_answers;

drop policy if exists "form_response_answers_access" on public.form_response_answers;
create policy "form_response_answers_access"
on public.form_response_answers
for all
to public
using (
  exists (
    select 1
    from public.client_form_assignments cfa
    join public.clients c on c.id = cfa.client_id
    where cfa.id = form_response_answers.assignment_id
      and (
        public.is_workspace_member(c.workspace_id)
        or c.portal_user_id = auth.uid()
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
  or public.is_platform_admin()
)
with check (
  exists (
    select 1
    from public.client_form_assignments cfa
    join public.clients c on c.id = cfa.client_id
    where cfa.id = form_response_answers.assignment_id
      and (
        public.is_workspace_member(c.workspace_id)
        or c.portal_user_id = auth.uid()
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
  or public.is_platform_admin()
);

-- ---------------------------------------------------------------------
-- client_form_assignments
-- ---------------------------------------------------------------------
drop policy if exists "anon_crud_client_form_assignments" on public.client_form_assignments;

drop policy if exists "client_form_assignments_staff_manage" on public.client_form_assignments;
create policy "client_form_assignments_staff_manage"
on public.client_form_assignments
for all
to public
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_form_assignments.client_id
      and public.has_workspace_role(
        c.workspace_id,
        array['owner','admin','ero','preparer','reviewer','intake_specialist']::membership_role[]
      )
  )
  or public.is_platform_admin()
)
with check (
  exists (
    select 1
    from public.clients c
    where c.id = client_form_assignments.client_id
      and public.has_workspace_role(
        c.workspace_id,
        array['owner','admin','ero','preparer','reviewer','intake_specialist']::membership_role[]
      )
  )
  or public.is_platform_admin()
);

drop policy if exists "client_form_assignments_client_select" on public.client_form_assignments;
create policy "client_form_assignments_client_select"
on public.client_form_assignments
for select
to public
using (
  exists (
    select 1
    from public.clients c
    where c.id = client_form_assignments.client_id
      and (
        public.is_workspace_member(c.workspace_id)
        or c.portal_user_id = auth.uid()
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
  or public.is_platform_admin()
);

-- ---------------------------------------------------------------------
-- intake_compliance_rules / intake_document_rules: template-scoped,
-- read-only reference data. Access follows can_access_template() for the
-- owning template, same rule staff/portal template reads already use.
-- ---------------------------------------------------------------------
drop policy if exists "anon_crud_intake_compliance_rules" on public.intake_compliance_rules;
drop policy if exists "intake_compliance_rules_access" on public.intake_compliance_rules;
create policy "intake_compliance_rules_access"
on public.intake_compliance_rules
for select
to public
using (
  exists (
    select 1
    from public.template_versions v
    where v.id = intake_compliance_rules.template_version_id
      and public.can_access_template(v.template_id)
  )
);

drop policy if exists "anon_crud_intake_document_rules" on public.intake_document_rules;
drop policy if exists "intake_document_rules_access" on public.intake_document_rules;
create policy "intake_document_rules_access"
on public.intake_document_rules
for select
to public
using (
  exists (
    select 1
    from public.template_versions v
    where v.id = intake_document_rules.template_version_id
      and public.can_access_template(v.template_id)
  )
);

-- ---------------------------------------------------------------------
-- Revoke unnecessary anon EXECUTE on the RLS helper functions these
-- policies depend on, so anon queries fail closed with permission-denied
-- rather than relying solely on row filtering.
-- ---------------------------------------------------------------------
revoke execute on function public.is_workspace_member(uuid) from anon;
revoke execute on function public.has_workspace_role(uuid, membership_role[]) from anon;
revoke execute on function public.is_platform_admin() from anon;
revoke execute on function public.can_access_template(uuid) from anon;
revoke execute on function public.can_manage_template(uuid) from anon;
