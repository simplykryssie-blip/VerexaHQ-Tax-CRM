-- Tighten function grants to match the existing schema's stricter convention:
-- trigger-only functions (never called directly via RPC) should not be
-- executable by anon/authenticated at all, mirroring
-- sync_document_request_item_counts()/sync_intake_progress(). RLS-helper
-- functions should remain authenticated-executable (RLS needs it) but not
-- anon-executable, mirroring can_access_document()/can_access_intake_submission().

revoke execute on function public.touch_conversation_on_message() from anon, authenticated;
revoke execute on function public.enforce_message_immutability() from anon, authenticated;
revoke execute on function public.can_access_conversation(uuid) from anon;

-- Pin search_path on the new trigger function (function_search_path_mutable).
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

revoke execute on function public.enforce_message_immutability() from anon, authenticated;
