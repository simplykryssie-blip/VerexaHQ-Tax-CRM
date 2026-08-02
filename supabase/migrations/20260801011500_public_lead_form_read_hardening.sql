-- The public form presentation reader does not need elevated privileges.
-- Allow anon to read only the safe source columns and only published rows.

drop policy if exists lead_forms_public_read on public.lead_forms;
create policy lead_forms_public_read on public.lead_forms for select to anon
using (status='published' and published_version_id is not null);

grant select(name,public_slug,status,published_version_id,confirmation_message,consent_text,embed_settings)
on public.lead_forms to anon;

create or replace function public.get_public_lead_form(p_public_slug text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'name',f.name,'public_slug',f.public_slug,'confirmation_message',f.confirmation_message,
    'consent_text',f.consent_text,'fields',coalesce(f.embed_settings->'fields','[]'::jsonb),
    'heading',coalesce(f.embed_settings->>'heading',f.name),'description',coalesce(f.embed_settings->>'description',''),
    'accent_color',coalesce(f.embed_settings->>'accent_color','#0f766e')
  ) from public.lead_forms f where f.public_slug=p_public_slug and f.status='published' and f.published_version_id is not null;
$$;

revoke all on function public.get_public_lead_form(text) from public;
grant execute on function public.get_public_lead_form(text) to anon,authenticated,service_role;
