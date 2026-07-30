-- The security advisor flagged four SECURITY DEFINER functions still
-- executable by anon: can_access_conversation, log_intake_answer_change,
-- touch_conversation_on_message, and enforce_message_immutability. Their
-- `anon`-role revokes from earlier migrations had no effect because
-- Postgres grants EXECUTE on new functions to PUBLIC by default, and a
-- role-specific revoke does not remove a privilege the role still holds via
-- PUBLIC. Revoke from PUBLIC directly, then re-grant only where genuinely
-- needed:
--   - can_access_conversation is called from within conversations/messages
--     RLS policies, so authenticated (and service_role) still need it.
--   - log_intake_answer_change, touch_conversation_on_message, and
--     enforce_message_immutability are trigger functions only. Triggers do
--     not require the invoking role to hold EXECUTE on the trigger
--     function, so revoking EXECUTE from every role except
--     postgres/service_role does not affect trigger firing.

revoke execute on function public.can_access_conversation(uuid) from public;
grant execute on function public.can_access_conversation(uuid) to authenticated, service_role, postgres;

revoke execute on function public.log_intake_answer_change() from public;
revoke execute on function public.log_intake_answer_change() from authenticated;
grant execute on function public.log_intake_answer_change() to service_role, postgres;

revoke execute on function public.touch_conversation_on_message() from public;
grant execute on function public.touch_conversation_on_message() to service_role, postgres;

revoke execute on function public.enforce_message_immutability() from public;
grant execute on function public.enforce_message_immutability() to service_role, postgres;
