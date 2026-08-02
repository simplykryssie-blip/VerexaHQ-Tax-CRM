-- These read-only evaluators can honor table RLS directly; they do not need definer privileges.
alter function public.get_my_permissions(uuid) security invoker;
alter function public.check_permission(uuid,text,jsonb) security invoker;
alter function public.has_permission(uuid,text,jsonb) security invoker;
