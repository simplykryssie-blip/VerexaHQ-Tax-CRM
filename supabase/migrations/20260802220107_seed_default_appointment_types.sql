-- The appointment-type dropdown appeared "empty" in the real firm
-- workspaces (MKB Financial Group, MKB ETechnologies) because the only
-- seeded appointment_types rows belonged to the 00000000...0001 demo
-- workspace -- the component/query were never broken, there was simply no
-- data for real workspaces. Backfill defaults for every workspace that
-- currently has zero rows, and add a trigger so every future workspace
-- gets the same defaults automatically (idempotent: only fires when the
-- new workspace has no appointment_types yet).
create or replace function public.seed_default_appointment_types(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (select 1 from public.appointment_types where workspace_id = p_workspace_id) then
    return;
  end if;
  insert into public.appointment_types (workspace_id, name, duration_minutes, location_type, is_active) values
  (p_workspace_id, 'Discovery Call', 30, 'phone', true),
  (p_workspace_id, 'Tax Consultation', 45, 'video', true),
  (p_workspace_id, 'Client Onboarding', 60, 'office', true),
  (p_workspace_id, 'Document Review', 30, 'office', true),
  (p_workspace_id, 'Tax Return Review', 45, 'video', true),
  (p_workspace_id, 'Bookkeeping Review', 30, 'video', true),
  (p_workspace_id, 'Payroll Consultation', 30, 'phone', true),
  (p_workspace_id, 'Tax Planning Meeting', 60, 'video', true),
  (p_workspace_id, 'Internal Meeting', 30, 'office', true),
  (p_workspace_id, 'Other', 30, 'office', true)
  on conflict (workspace_id, name) do nothing;
end;
$$;

do $$
declare r record;
begin
  for r in select id from public.workspaces where not exists (select 1 from public.appointment_types t where t.workspace_id = workspaces.id)
  loop
    perform public.seed_default_appointment_types(r.id);
  end loop;
end $$;

create or replace function public.trg_seed_appointment_types_for_new_workspace()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform public.seed_default_appointment_types(new.id);
  return new;
end;
$$;

drop trigger if exists seed_appointment_types_on_workspace_insert on public.workspaces;
create trigger seed_appointment_types_on_workspace_insert
after insert on public.workspaces
for each row execute function public.trg_seed_appointment_types_for_new_workspace();
