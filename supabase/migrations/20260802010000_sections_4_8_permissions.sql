-- Complete the granular permission vocabulary used by frontend Sections 4-8.
-- Existing RLS remains authoritative; these grants drive navigation and the
-- matching server-side action checks.

insert into public.permission_definitions
  (permission_key, resource, action, description, risk_level, allowed_scopes, owner_only)
values
  ('intakes.manage','intakes','manage','Assign, review, reopen, and complete client organizers','high',array['assigned','team','workspace'],false),
  ('documents.manage','documents','manage','Request, categorize, review, reject, and replace client documents','high',array['assigned','team','workspace'],false),
  ('communications.send','communications','send','Send and schedule client communications','high',array['assigned','team','workspace'],false),
  ('communications.bulk','communications','bulk','Send a permission-scoped bulk communication','high',array['team','workspace'],false),
  ('appointments.view','appointments','view','View workspace appointments','standard',array['assigned','team','workspace'],false),
  ('appointments.manage','appointments','manage','Create, edit, cancel, and reschedule appointments','standard',array['assigned','team','workspace'],false),
  ('signatures.view','signatures','view','View signature requests and signer status','sensitive',array['assigned','team','workspace'],false),
  ('signatures.manage','signatures','manage','Create and manage ordinary e-signature requests','high',array['assigned','team','workspace'],false),
  ('billing.refund','billing','refund','Void, refund, and adjust recorded payments','high',array['workspace'],false),
  ('returns.view','returns','view','View completed-return release status and deliveries','sensitive',array['assigned','team','workspace'],false),
  ('portal.preview','portal','preview','Open an audited, read-only client portal preview','sensitive',array['assigned','team','workspace'],false),
  ('automation.view','automation','view','View automation definitions and run history','standard',array['assigned','team','workspace'],false),
  ('automation.manage','automation','manage','Build, publish, pause, and archive automations','high',array['workspace'],false),
  ('automation.retry','automation','retry','Retry failed automation jobs','high',array['team','workspace'],false)
on conflict (permission_key) do update set
  description=excluded.description,
  risk_level=excluded.risk_level,
  allowed_scopes=excluded.allowed_scopes,
  owner_only=excluded.owner_only;

with grants(role_key, permission_key, permission_scope) as (values
  ('owner','intakes.manage','workspace'),('owner','documents.manage','workspace'),('owner','communications.send','workspace'),('owner','communications.bulk','workspace'),('owner','appointments.view','workspace'),('owner','appointments.manage','workspace'),('owner','signatures.view','workspace'),('owner','signatures.manage','workspace'),('owner','billing.refund','workspace'),('owner','returns.view','workspace'),('owner','portal.preview','workspace'),('owner','automation.view','workspace'),('owner','automation.manage','workspace'),('owner','automation.retry','workspace'),
  ('admin','intakes.manage','workspace'),('admin','documents.manage','workspace'),('admin','communications.send','workspace'),('admin','communications.bulk','workspace'),('admin','appointments.view','workspace'),('admin','appointments.manage','workspace'),('admin','signatures.view','workspace'),('admin','signatures.manage','workspace'),('admin','billing.refund','workspace'),('admin','returns.view','workspace'),('admin','portal.preview','workspace'),('admin','automation.view','workspace'),('admin','automation.manage','workspace'),('admin','automation.retry','workspace'),
  ('ero','intakes.manage','workspace'),('ero','documents.manage','workspace'),('ero','communications.send','workspace'),('ero','communications.bulk','workspace'),('ero','appointments.view','workspace'),('ero','appointments.manage','workspace'),('ero','signatures.view','workspace'),('ero','signatures.manage','workspace'),('ero','billing.refund','workspace'),('ero','returns.view','workspace'),('ero','portal.preview','workspace'),('ero','automation.view','workspace'),('ero','automation.manage','workspace'),('ero','automation.retry','workspace'),
  ('preparer','intakes.manage','assigned'),('preparer','documents.manage','assigned'),('preparer','communications.send','assigned'),('preparer','appointments.view','assigned'),('preparer','appointments.manage','assigned'),('preparer','signatures.view','assigned'),('preparer','signatures.manage','assigned'),('preparer','returns.view','assigned'),('preparer','portal.preview','assigned'),('preparer','automation.view','assigned'),
  ('reviewer','intakes.manage','workspace'),('reviewer','documents.manage','workspace'),('reviewer','communications.send','assigned'),('reviewer','appointments.view','workspace'),('reviewer','signatures.view','workspace'),('reviewer','returns.view','workspace'),('reviewer','portal.preview','workspace'),('reviewer','automation.view','workspace'),
  ('intake_specialist','intakes.manage','assigned'),('intake_specialist','documents.manage','assigned'),('intake_specialist','communications.send','assigned'),('intake_specialist','appointments.view','assigned'),('intake_specialist','appointments.manage','assigned'),('intake_specialist','portal.preview','assigned'),('intake_specialist','automation.view','assigned'),
  ('document_specialist','documents.manage','assigned'),('document_specialist','communications.send','assigned'),('document_specialist','appointments.view','assigned'),('document_specialist','portal.preview','assigned'),('document_specialist','automation.view','assigned'),
  ('billing','communications.send','workspace'),('billing','appointments.view','workspace'),('billing','signatures.view','workspace'),('billing','billing.refund','workspace'),('billing','portal.preview','workspace'),('billing','automation.view','workspace'),
  ('seasonal_staff','appointments.view','assigned'),('seasonal_staff','automation.view','assigned'),
  ('auditor','appointments.view','workspace'),('auditor','signatures.view','workspace'),('auditor','returns.view','workspace'),('auditor','automation.view','workspace')
)
insert into public.role_permissions(role_definition_id,permission_key,effect,permission_scope)
select rd.id,g.permission_key,'allow',g.permission_scope
from grants g
join public.role_definitions rd on rd.is_system and rd.role_key=g.role_key
on conflict (role_definition_id,permission_key) do update
set effect='allow', permission_scope=excluded.permission_scope;

-- EROs operate the tax office. They can manage operational configuration,
-- templates, workflows, billing, and provider connections without receiving
-- owner-only subscription or permission-administration powers.
with grants(permission_key) as (values
  ('templates.manage'),
  ('workflows.manage'),
  ('billing.manage'),
  ('integrations.manage'),
  ('settings.manage'),
  ('team.manage')
)
insert into public.role_permissions(role_definition_id,permission_key,effect,permission_scope)
select rd.id,g.permission_key,'allow','workspace'
from grants g
join public.role_definitions rd on rd.is_system and rd.role_key='ero'
on conflict (role_definition_id,permission_key) do update
set effect='allow', permission_scope='workspace';
