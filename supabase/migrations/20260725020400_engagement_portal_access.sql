-- Tax Engagement Management, part 5: client portal read access.
--
-- A client may read their own engagements. Row-Level Security in Postgres
-- is row-granular, not column-granular, so -- exactly like the existing
-- clients table (whose owning client can read the full row via
-- clients_contact_portal_access, including ssn_last4/ein_last4, relying on
-- the app's server-side data mapper to only ever select client-safe
-- columns) -- this policy grants row access, and lib/data/portal-engagements.ts
-- is the enforcement point that selects only a client-safe explicit column
-- list. Internal-only tables (engagement_status_history activity,
-- engagement_notes unless is_client_visible) get their own dedicated
-- policies rather than reusing this one, so those stay staff-only /
-- client-visible-only regardless of app code.
create policy "tax_engagements_portal_access"
on public.tax_engagements
for select
to public
using (
  exists (
    select 1
    from public.clients c
    where c.id = tax_engagements.client_id
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

-- Sanity re-check: no policy anywhere on the new/changed tables should be
-- callable by anon or use an unscoped true qualifier. This is a documentation
-- query (SELECT only), included so the migration file itself records the
-- verification that was run; it has no side effects.
do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and tablename in ('tax_engagements', 'engagement_status_history', 'engagement_notes', 'engagement_reference_sequences')
    and (roles::text like '%anon%' or qual = 'true' or with_check = 'true');

  if v_count > 0 then
    raise exception 'Unsafe policy detected on engagement tables (% found)', v_count;
  end if;
end $$;
