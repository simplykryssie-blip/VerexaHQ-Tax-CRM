-- Client self-service profile updates.
--
-- Neither `clients` nor `client_addresses` had any client-facing write
-- policy at all (clients_staff_manage / client_addresses_staff_manage are
-- both staff-role-gated ALL policies), so a portal client could not update
-- so much as their own phone number. RLS is row-level, not column-level, so
-- rather than adding a broad client UPDATE policy on `clients` (which would
-- let a client rewrite ANY column, including status, workspace_id, or
-- assigned preparer), two narrow SECURITY DEFINER functions expose only the
-- exact fields the client portal is allowed to change — mirroring the
-- existing can_access_intake_submission() ownership-check pattern.

create or replace function public.update_client_portal_contact_info(
  p_client_id uuid,
  p_phone text,
  p_preferred_contact_method public.contact_method
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id and (
      c.portal_user_id = auth.uid()
      or exists (
        select 1 from public.client_contacts cc
        where cc.client_id = c.id and cc.auth_user_id = auth.uid()
          and cc.can_access_portal = true and cc.is_active = true
      )
    )
  ) then
    raise exception 'Not authorized';
  end if;

  update public.clients
  set phone = p_phone,
      preferred_contact_method = p_preferred_contact_method,
      updated_at = now()
  where id = p_client_id;
end;
$$;

comment on function public.update_client_portal_contact_info(uuid, text, public.contact_method) is
  'Client-portal self-service: updates only phone + preferred_contact_method on the caller''s own linked client record. Never touches name, status, workspace, assigned preparer, or any identity field.';

revoke all on function public.update_client_portal_contact_info(uuid, text, public.contact_method) from public;
grant execute on function public.update_client_portal_contact_info(uuid, text, public.contact_method) to authenticated;

create or replace function public.update_client_mailing_address(
  p_client_id uuid,
  p_line1 text,
  p_line2 text,
  p_city text,
  p_state text,
  p_postal_code text
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_workspace uuid;
begin
  select c.workspace_id into v_workspace
  from public.clients c
  where c.id = p_client_id and (
    c.portal_user_id = auth.uid()
    or exists (
      select 1 from public.client_contacts cc
      where cc.client_id = c.id and cc.auth_user_id = auth.uid()
        and cc.can_access_portal = true and cc.is_active = true
    )
  );

  if v_workspace is null then
    raise exception 'Not authorized';
  end if;

  update public.client_addresses
  set line1 = p_line1, line2 = p_line2, city = p_city, state = p_state, postal_code = p_postal_code, updated_at = now()
  where client_id = p_client_id and address_type = 'mailing';

  if not found then
    insert into public.client_addresses (workspace_id, client_id, address_type, line1, line2, city, state, postal_code, is_primary)
    values (v_workspace, p_client_id, 'mailing', p_line1, p_line2, p_city, p_state, p_postal_code, true);
  end if;
end;
$$;

comment on function public.update_client_mailing_address(uuid, text, text, text, text, text) is
  'Client-portal self-service: upserts only the "mailing" client_addresses row for the caller''s own linked client record.';

revoke all on function public.update_client_mailing_address(uuid, text, text, text, text, text) from public;
grant execute on function public.update_client_mailing_address(uuid, text, text, text, text, text) to authenticated;

-- Additive read access so the profile page can display the client's own
-- mailing address (previously no client-facing SELECT policy existed at all).
create policy "client_addresses_client_select" on public.client_addresses
  for select
  using (
    exists (
      select 1 from public.clients c
      where c.id = client_addresses.client_id and (
        c.portal_user_id = auth.uid()
        or exists (
          select 1 from public.client_contacts cc
          where cc.client_id = c.id and cc.auth_user_id = auth.uid()
            and cc.can_access_portal = true and cc.is_active = true
        )
      )
    )
  );
