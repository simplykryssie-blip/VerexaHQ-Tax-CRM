insert into public.permission_definitions(permission_key,resource,action,description,risk_level,allowed_scopes,owner_only)
values('engagements.advance','engagements','advance','Move an engagement through an allowed frozen-workflow transition','high',array['assigned','team','workspace'],false)
on conflict(permission_key) do update set description=excluded.description,risk_level=excluded.risk_level,allowed_scopes=excluded.allowed_scopes;

with grants(role_key,permission_scope) as (values
  ('owner','workspace'),('admin','workspace'),('ero','workspace'),
  ('preparer','assigned'),('reviewer','workspace')
)
insert into public.role_permissions(role_definition_id,permission_key,effect,permission_scope)
select rd.id,'engagements.advance','allow',g.permission_scope
from grants g join public.role_definitions rd on rd.is_system and rd.role_key=g.role_key
on conflict(role_definition_id,permission_key) do update set effect='allow',permission_scope=excluded.permission_scope;
