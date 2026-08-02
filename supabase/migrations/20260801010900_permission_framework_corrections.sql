-- Admins may administer staff roles; ownership transfer and subscription ownership remain owner-only.
update public.permission_definitions
set owner_only=false
where permission_key='permissions.manage';

insert into public.role_permissions(role_definition_id,permission_key,effect,permission_scope)
select r.id,'permissions.manage','allow','workspace'
from public.role_definitions r
where r.is_system and r.system_role='admin'
on conflict (role_definition_id,permission_key)
do update set effect='allow',permission_scope='workspace';
