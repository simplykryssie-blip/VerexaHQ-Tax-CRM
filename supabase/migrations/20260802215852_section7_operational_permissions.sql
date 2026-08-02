-- Additive permission definitions for invoices, appointment types, per-staff
-- Zoom self-connection, and a reserved (unwired) payout-report permission.
-- Follows the existing coarse resource.action convention already used by
-- templates.manage / workflows.manage / lead_sources.manage rather than the
-- finer-grained forms.create/edit/clone naming a prior draft used.
insert into public.permission_definitions (permission_key, resource, action, description, risk_level, allowed_scopes, owner_only) values
('invoices.manage', 'invoices', 'manage', 'Create, edit, send, and void invoices', 'sensitive', array['workspace','assigned'], false),
('invoices.view', 'invoices', 'view', 'View invoices and payment history', 'standard', array['workspace','assigned'], false),
('appointment_types.manage', 'appointment_types', 'manage', 'Create, edit, reorder, activate, and archive appointment types', 'standard', array['workspace'], false),
('zoom.connect_own', 'zoom', 'connect_own', 'Connect, reconnect, and disconnect your own Zoom account for meetings you host', 'standard', array['assigned'], false),
('reports.view_payouts', 'reports', 'view_payouts', 'View ERO-to-PTIN payout reports (reserved; not yet wired to any UI -- payout business rules are pending owner approval)', 'sensitive', array['workspace'], true)
on conflict (permission_key) do update set
  description = excluded.description,
  risk_level = excluded.risk_level,
  allowed_scopes = excluded.allowed_scopes,
  owner_only = excluded.owner_only;

-- Grants. Workspace-wide Zoom app oversight (connecting/disconnecting other
-- staff, workspace default provider settings) reuses the existing
-- integrations.manage permission rather than adding a redundant
-- zoom.manage_workspace key -- owner/admin/ero already hold it.
with grants as (
  select * from (values
    ('owner', 'invoices.manage', 'allow', 'workspace'),
    ('owner', 'invoices.view', 'allow', 'workspace'),
    ('owner', 'appointment_types.manage', 'allow', 'workspace'),
    ('owner', 'reports.view_payouts', 'allow', 'workspace'),
    ('owner', 'zoom.connect_own', 'allow', 'assigned'),
    ('admin', 'invoices.manage', 'allow', 'workspace'),
    ('admin', 'invoices.view', 'allow', 'workspace'),
    ('admin', 'appointment_types.manage', 'allow', 'workspace'),
    ('admin', 'zoom.connect_own', 'allow', 'assigned'),
    ('ero', 'invoices.manage', 'allow', 'workspace'),
    ('ero', 'invoices.view', 'allow', 'workspace'),
    ('ero', 'appointment_types.manage', 'allow', 'workspace'),
    ('ero', 'zoom.connect_own', 'allow', 'assigned'),
    ('billing', 'invoices.manage', 'allow', 'workspace'),
    ('billing', 'invoices.view', 'allow', 'workspace'),
    ('billing', 'zoom.connect_own', 'allow', 'assigned'),
    ('auditor', 'invoices.view', 'allow', 'workspace'),
    ('preparer', 'zoom.connect_own', 'allow', 'assigned'),
    ('reviewer', 'zoom.connect_own', 'allow', 'assigned'),
    ('intake_specialist', 'zoom.connect_own', 'allow', 'assigned'),
    ('document_specialist', 'zoom.connect_own', 'allow', 'assigned'),
    ('seasonal_staff', 'zoom.connect_own', 'allow', 'assigned')
  ) as g(role_key, permission_key, effect, permission_scope)
)
insert into public.role_permissions (role_definition_id, permission_key, effect, permission_scope)
select rd.id, g.permission_key, g.effect, g.permission_scope
from grants g
join public.role_definitions rd on rd.is_system and rd.role_key = g.role_key
join public.permission_definitions p on p.permission_key = g.permission_key
where not (p.owner_only and g.role_key <> 'owner')
on conflict (role_definition_id, permission_key) do update set
  effect = excluded.effect,
  permission_scope = excluded.permission_scope;

-- preparer already has full RLS-level invoice access (invoices_staff_all
-- policy), which pre-dates and does not consult this granular table --
-- grant the same here so the two layers agree.
with grants as (
  select * from (values
    ('preparer', 'invoices.manage', 'allow', 'assigned'),
    ('preparer', 'invoices.view', 'allow', 'assigned')
  ) as g(role_key, permission_key, effect, permission_scope)
)
insert into public.role_permissions (role_definition_id, permission_key, effect, permission_scope)
select rd.id, g.permission_key, g.effect, g.permission_scope
from grants g
join public.role_definitions rd on rd.is_system and rd.role_key = g.role_key
join public.permission_definitions p on p.permission_key = g.permission_key
on conflict (role_definition_id, permission_key) do update set effect = excluded.effect, permission_scope = excluded.permission_scope;
