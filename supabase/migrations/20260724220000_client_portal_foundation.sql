-- Client Portal Foundation: security fixes + minimal additive schema.
--
-- 1) SECURITY FIX: "anon_crud_clients" was a pre-existing policy that let ANY
--    caller (authenticated or anon) SELECT every client row across every
--    workspace, with no scoping at all. That directly defeats the per-client,
--    per-workspace isolation this portal depends on, so it is removed here.
--    (Similar "anon_crud_*" policies exist on other unrelated tables —
--    workspaces, services, notifications, form_templates, form_questions,
--    form_response_answers, client_form_assignments — and are flagged in the
--    PR/README as a follow-up; they are out of scope for this migration
--    since they don't affect the client portal's own security guarantees.)
drop policy if exists "anon_crud_clients" on public.clients;

-- 2) Additive: allow a client_contacts-linked portal user (e.g. a spouse or
--    authorized contact granted can_access_portal) to read the parent
--    `clients` row. can_access_document() / can_access_intake_submission()
--    already grant these secondary contacts access to a client's documents
--    and intake data, but the `clients` table itself only allowed the
--    primary `portal_user_id`. This closes that gap using the exact same
--    pattern already used everywhere else in the schema.
create policy "clients_contact_portal_access" on public.clients
  for select
  using (
    exists (
      select 1 from public.client_contacts cc
      where cc.client_id = clients.id
        and cc.auth_user_id = auth.uid()
        and cc.can_access_portal = true
        and cc.is_active = true
    )
  );

-- 3) Additive: allow a client to post their own reply in the clarification
--    thread (intake_review_comments). Staff already create clarification
--    requests via request_intake_clarification(); this lets the client
--    respond in the same thread. A client can only ever insert — never
--    update — and every insert must be self-authored, client-visible, and
--    already unresolved, so a client can never resolve their own
--    clarification (resolution stays exclusively via
--    resolve_intake_clarification(), a staff-only RPC).
create policy "intake_review_comments_client_reply" on public.intake_review_comments
  for insert
  with check (
    public.can_access_intake_submission(submission_id)
    and created_by = auth.uid()
    and is_client_visible = true
    and resolved_at is null
    and resolved_by is null
  );

-- 4) Minimal secure messaging schema (no existing conversations/messages
--    tables were found in the schema).
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  client_id uuid not null references public.clients(id),
  subject text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz
);

comment on table public.conversations is 'Secure message threads between workspace staff and a single client. Client portal foundation.';

create index conversations_workspace_client_idx on public.conversations (workspace_id, client_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id),
  conversation_id uuid not null references public.conversations(id),
  sender_user_id uuid not null,
  sender_type text not null check (sender_type in ('staff','client')),
  body text not null check (char_length(body) between 1 and 8000),
  client_visible boolean not null default true,
  attachment_document_id uuid references public.documents(id),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.messages is 'Individual messages within a conversation. read_at marks when the counterpart (not the sender) read the message. Client portal foundation.';

create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_workspace_idx on public.messages (workspace_id);

create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select exists(
    select 1 from public.conversations c
    join public.clients cl on cl.id = c.client_id
    where c.id = p_conversation_id and (
      public.is_workspace_member(c.workspace_id) or
      cl.portal_user_id = auth.uid() or
      exists(select 1 from public.client_contacts cc where cc.client_id=cl.id and cc.auth_user_id=auth.uid() and cc.can_access_portal=true and cc.is_active=true) or
      public.is_platform_admin()
    )
  );
$$;

comment on function public.can_access_conversation(uuid) is 'Mirrors can_access_intake_submission()/can_access_document(): true for workspace staff or the linked client (primary portal user or an active portal-enabled contact).';

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

create policy "conversations_select" on public.conversations
  for select
  using (public.can_access_conversation(id));

create policy "conversations_insert_staff" on public.conversations
  for insert
  with check (public.is_workspace_member(workspace_id) or public.is_platform_admin());

create policy "conversations_insert_client" on public.conversations
  for insert
  with check (
    exists (
      select 1 from public.clients cl
      where cl.id = conversations.client_id
        and cl.workspace_id = conversations.workspace_id
        and (
          cl.portal_user_id = auth.uid() or
          exists(select 1 from public.client_contacts cc where cc.client_id=cl.id and cc.auth_user_id=auth.uid() and cc.can_access_portal=true and cc.is_active=true)
        )
    )
  );

create policy "conversations_update" on public.conversations
  for update
  using (public.can_access_conversation(id))
  with check (public.can_access_conversation(id));

create policy "conversations_delete_staff" on public.conversations
  for delete
  using (public.has_workspace_role(workspace_id, array['owner','admin','ero']::public.membership_role[]) or public.is_platform_admin());

create policy "messages_select" on public.messages
  for select
  using (
    public.can_access_conversation(conversation_id)
    and (client_visible = true or public.is_workspace_member(workspace_id))
  );

create policy "messages_insert" on public.messages
  for insert
  with check (
    public.can_access_conversation(conversation_id)
    and sender_user_id = auth.uid()
    and (
      (sender_type = 'staff' and public.is_workspace_member(workspace_id)) or
      (sender_type = 'client' and exists (
        select 1 from public.conversations c join public.clients cl on cl.id=c.client_id
        where c.id = messages.conversation_id and (
          cl.portal_user_id = auth.uid() or
          exists(select 1 from public.client_contacts cc where cc.client_id=cl.id and cc.auth_user_id=auth.uid() and cc.can_access_portal=true and cc.is_active=true)
        )
      ))
    )
  );

-- Messages are otherwise immutable; only read_at may change (read receipts),
-- enforced by trigger below rather than by RLS (RLS can't restrict which
-- columns an UPDATE touches).
create policy "messages_update_read_receipt" on public.messages
  for update
  using (public.can_access_conversation(conversation_id))
  with check (public.can_access_conversation(conversation_id));

create or replace function public.enforce_message_immutability()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if new.body is distinct from old.body
    or new.sender_user_id is distinct from old.sender_user_id
    or new.sender_type is distinct from old.sender_type
    or new.conversation_id is distinct from old.conversation_id
    or new.client_visible is distinct from old.client_visible
    or new.workspace_id is distinct from old.workspace_id
  then
    raise exception 'Messages are immutable except for read_at.';
  end if;
  return new;
end;
$$;

create trigger enforce_message_immutability_trigger
  before update on public.messages
  for each row execute function public.enforce_message_immutability();

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  update public.conversations set last_message_at = new.created_at, updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger touch_conversation_on_message_trigger
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- 5) Missing indexes on hot RLS-lookup / trigger-lookup paths.
create index if not exists client_contacts_auth_user_idx on public.client_contacts (auth_user_id) where auth_user_id is not null;
create index if not exists documents_request_item_idx on public.documents (request_item_id) where request_item_id is not null;
