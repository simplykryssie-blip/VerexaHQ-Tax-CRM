-- Tax Engagement Management, part 4: engagement notes. No existing
-- general-purpose notes table was found (clients.notes and
-- document_requests.internal_notes are single free-text summary fields,
-- not a note history), so this creates a dedicated table. Internal notes
-- are never client-visible by default -- is_client_visible defaults false
-- and must be explicitly set true to appear in the client portal.

create table public.engagement_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  engagement_id uuid not null references public.tax_engagements(id) on delete cascade,
  author_user_id uuid,
  body text not null,
  note_type text not null default 'general',
  is_pinned boolean not null default false,
  is_client_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.engagement_notes is 'Engagement note history. is_client_visible defaults false; only explicitly-marked notes are exposed to the client portal.';

create index idx_engagement_notes_engagement on public.engagement_notes(engagement_id, created_at desc);
create index idx_engagement_notes_workspace on public.engagement_notes(workspace_id);

alter table public.engagement_notes enable row level security;

-- Staff: any workspace member who can access the engagement can read all
-- notes (including internal-only ones); only staff who can manage the
-- engagement can write.
create policy "engagement_notes_staff_select"
on public.engagement_notes
for select
to public
using (public.can_access_engagement(engagement_id));

create policy "engagement_notes_staff_manage"
on public.engagement_notes
for all
to public
using (public.can_manage_engagement(engagement_id))
with check (public.can_manage_engagement(engagement_id));

-- Client portal: a client may read only notes on their own engagement that
-- are explicitly marked client-visible. Clients never get insert/update/
-- delete access -- notes are staff-authored only.
create policy "engagement_notes_client_select"
on public.engagement_notes
for select
to public
using (
  is_client_visible = true
  and exists (
    select 1
    from public.tax_engagements e
    join public.clients c on c.id = e.client_id
    where e.id = engagement_notes.engagement_id
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

create trigger engagement_notes_set_updated_at
  before update on public.engagement_notes
  for each row
  execute function public.set_updated_at();
