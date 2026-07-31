-- Security hardening: the Supabase advisor flags these 7 functions with
-- function_search_path_mutable because they have no proconfig search_path
-- pinned, which would let a caller who can create objects earlier in an
-- unqualified search_path shadow the public-schema tables these functions
-- reference. All 7 are SECURITY INVOKER, plpgsql, owned by postgres, and
-- only reference unqualified public-schema tables (form_templates,
-- form_questions, client_form_assignments, clients, notifications,
-- form_response_answers) plus the always-resolvable now(); none need any
-- schema other than public, so `public, pg_temp` is sufficient and safe.
-- Function bodies are unchanged (ALTER FUNCTION ... SET does not touch
-- the function definition).

alter function public.create_form_template(uuid, text, text, text, boolean) set search_path = public, pg_temp;
alter function public.add_form_question(uuid, text, text, text, boolean, jsonb, integer) set search_path = public, pg_temp;
alter function public.assign_form_to_client(uuid, uuid, uuid, date, text, text) set search_path = public, pg_temp;
alter function public.save_form_answer(uuid, uuid, text, jsonb) set search_path = public, pg_temp;
alter function public.submit_assigned_form(uuid) set search_path = public, pg_temp;
alter function public.mark_assigned_form_reviewed(uuid, text) set search_path = public, pg_temp;
alter function public.request_form_changes(uuid, text) set search_path = public, pg_temp;

-- Grant hygiene: these are staff-only form-builder/assignment mutation
-- functions (confirmed unused by the application's portal or staff code,
-- and by no RLS policy). They currently have EXECUTE granted to anon (both
-- directly and via the default PUBLIC grant), which serves no legitimate
-- purpose -- anonymous callers have no business creating templates,
-- questions, or assignments, or acting on them. Revoke from PUBLIC/anon,
-- keep EXECUTE for authenticated (the intended staff caller) and the
-- existing postgres/service_role grants.

revoke execute on function public.create_form_template(uuid, text, text, text, boolean) from public;
revoke execute on function public.create_form_template(uuid, text, text, text, boolean) from anon;
grant execute on function public.create_form_template(uuid, text, text, text, boolean) to authenticated;

revoke execute on function public.add_form_question(uuid, text, text, text, boolean, jsonb, integer) from public;
revoke execute on function public.add_form_question(uuid, text, text, text, boolean, jsonb, integer) from anon;
grant execute on function public.add_form_question(uuid, text, text, text, boolean, jsonb, integer) to authenticated;

revoke execute on function public.assign_form_to_client(uuid, uuid, uuid, date, text, text) from public;
revoke execute on function public.assign_form_to_client(uuid, uuid, uuid, date, text, text) from anon;
grant execute on function public.assign_form_to_client(uuid, uuid, uuid, date, text, text) to authenticated;

revoke execute on function public.save_form_answer(uuid, uuid, text, jsonb) from public;
revoke execute on function public.save_form_answer(uuid, uuid, text, jsonb) from anon;
grant execute on function public.save_form_answer(uuid, uuid, text, jsonb) to authenticated;

revoke execute on function public.submit_assigned_form(uuid) from public;
revoke execute on function public.submit_assigned_form(uuid) from anon;
grant execute on function public.submit_assigned_form(uuid) to authenticated;

revoke execute on function public.mark_assigned_form_reviewed(uuid, text) from public;
revoke execute on function public.mark_assigned_form_reviewed(uuid, text) from anon;
grant execute on function public.mark_assigned_form_reviewed(uuid, text) to authenticated;

revoke execute on function public.request_form_changes(uuid, text) from public;
revoke execute on function public.request_form_changes(uuid, text) from anon;
grant execute on function public.request_form_changes(uuid, text) to authenticated;
