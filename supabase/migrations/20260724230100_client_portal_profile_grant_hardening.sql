-- The prior "revoke all ... from public" did not remove anon's execute
-- privilege (verified via has_function_privilege), so revoke from anon
-- explicitly instead, matching can_access_document()/
-- can_access_intake_submission()'s convention (authenticated-only, no anon).
revoke execute on function public.update_client_portal_contact_info(uuid, text, public.contact_method) from anon;
revoke execute on function public.update_client_mailing_address(uuid, text, text, text, text, text) from anon;
