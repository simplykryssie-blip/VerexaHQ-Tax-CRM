-- Advisor hardening for the engagement activation module.

begin;

drop policy if exists engagement_activation_runs_manage on public.engagement_activation_runs;

create policy engagement_activation_runs_insert
on public.engagement_activation_runs for insert to authenticated
with check (public.can_manage_engagement(engagement_id) or public.is_platform_admin());

create policy engagement_activation_runs_update
on public.engagement_activation_runs for update to authenticated
using (public.can_manage_engagement(engagement_id) or public.is_platform_admin())
with check (public.can_manage_engagement(engagement_id) or public.is_platform_admin());

create policy engagement_activation_runs_delete
on public.engagement_activation_runs for delete to authenticated
using (public.can_manage_engagement(engagement_id) or public.is_platform_admin());

create index engagement_activation_runs_setting_idx
  on public.engagement_activation_runs(engagement_type_setting_id)
  where engagement_type_setting_id is not null;
create index engagement_activation_runs_organizer_idx
  on public.engagement_activation_runs(organizer_submission_id)
  where organizer_submission_id is not null;
create index engagement_activation_runs_letter_idx
  on public.engagement_activation_runs(engagement_letter_id)
  where engagement_letter_id is not null;
create index engagement_activation_runs_document_request_idx
  on public.engagement_activation_runs(document_request_id)
  where document_request_id is not null;
create index engagement_activation_runs_invoice_idx
  on public.engagement_activation_runs(invoice_id)
  where invoice_id is not null;
create index engagement_activation_runs_delivery_job_idx
  on public.engagement_activation_runs(portal_delivery_job_id)
  where portal_delivery_job_id is not null;
create index engagement_activation_runs_activated_by_idx
  on public.engagement_activation_runs(activated_by)
  where activated_by is not null;

comment on function public.activate_tax_engagement(uuid,text) is
  'Intentional authenticated SECURITY DEFINER RPC. It requires auth.uid(), verifies can_manage_engagement, constrains all writes to the engagement workspace, and exposes only package activation.';
comment on function public.evaluate_return_release(uuid) is
  'Intentional authenticated SECURITY DEFINER RPC. It requires auth.uid(), verifies workspace membership, and returns only release eligibility for an accessible engagement.';
comment on function public.release_completed_return(uuid,text) is
  'Intentional authenticated SECURITY DEFINER RPC. It requires auth.uid(), verifies can_manage_engagement, re-evaluates release blockers, and writes an audit record.';

commit;
