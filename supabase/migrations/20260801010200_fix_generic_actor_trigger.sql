-- Fix the existing generic audit trigger. Directly referencing a field that is
-- absent from a trigger record raises an error even when guarded by to_jsonb().

create or replace function public.stamp_record_actor()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
declare
  v_record jsonb := to_jsonb(new);
  v_actor jsonb := to_jsonb(auth.uid());
begin
  if tg_op='INSERT' then
    if v_record ? 'created_by_user_id' and v_record->'created_by_user_id'='null'::jsonb then
      v_record := jsonb_set(v_record,'{created_by_user_id}',v_actor,true);
    end if;
    if v_record ? 'created_by' and v_record->'created_by'='null'::jsonb then
      v_record := jsonb_set(v_record,'{created_by}',v_actor,true);
    end if;
  end if;
  if v_record ? 'updated_by_user_id' then
    v_record := jsonb_set(v_record,'{updated_by_user_id}',v_actor,true);
  end if;
  new := jsonb_populate_record(new,v_record);
  return new;
end;
$$;

revoke execute on function public.stamp_record_actor() from public, anon, authenticated;
grant execute on function public.stamp_record_actor() to service_role;
