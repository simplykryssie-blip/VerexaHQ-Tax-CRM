-- Verexa Tax Office: service-package defaults, idempotent engagement activation,
-- and a reliable completed-return release gate.

begin;

-- Household/family is a relationship group, not a client record type. Keep the
-- legacy enum labels for compatibility while enforcing the supported values.
alter table public.clients
  drop constraint if exists clients_supported_client_type;
alter table public.clients
  add constraint clients_supported_client_type
  check (client_type::text in ('individual','business')) not valid;
alter table public.clients validate constraint clients_supported_client_type;

-- Complete the service-package contract without creating a second service table.
alter table public.engagement_type_settings
  add column if not exists default_tasks jsonb not null default '[]'::jsonb,
  add column if not exists default_messages jsonb not null default '{}'::jsonb,
  add column if not exists reminder_settings jsonb not null default '{}'::jsonb,
  add column if not exists invoice_settings jsonb not null default '{"create_on_activation":false}'::jsonb,
  add column if not exists release_settings jsonb not null default '{"require_payment":true,"require_signature":true,"require_review_approval":true,"require_filing_acceptance":false}'::jsonb,
  add column if not exists portal_settings jsonb not null default '{"invite_on_send":true}'::jsonb;

create table public.engagement_activation_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  engagement_id uuid not null unique references public.tax_engagements(id) on delete cascade,
  engagement_type_setting_id uuid references public.engagement_type_settings(id) on delete set null,
  activation_mode text not null check (activation_mode in ('activate_without_sending','activate_and_send')),
  status text not null default 'prepared' check (status in ('prepared','delivery_queued','sent')),
  organizer_submission_id uuid references public.intake_submissions(id) on delete set null,
  engagement_letter_id uuid references public.engagement_letters(id) on delete set null,
  document_request_id uuid references public.document_requests(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  portal_delivery_job_id uuid references public.automation_jobs(id) on delete set null,
  artifacts jsonb not null default '{}'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz not null default now(),
  delivery_queued_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.engagement_activation_runs enable row level security;
grant select, insert, update, delete on table public.engagement_activation_runs to authenticated, service_role;

create policy engagement_activation_runs_select
on public.engagement_activation_runs for select to authenticated
using (public.can_access_engagement(engagement_id) or public.is_platform_admin());

create policy engagement_activation_runs_manage
on public.engagement_activation_runs for all to authenticated
using (public.can_manage_engagement(engagement_id) or public.is_platform_admin())
with check (public.can_manage_engagement(engagement_id) or public.is_platform_admin());

create index engagement_activation_runs_workspace_idx
  on public.engagement_activation_runs(workspace_id, activated_at desc);

drop trigger if exists engagement_activation_runs_updated_at on public.engagement_activation_runs;
create trigger engagement_activation_runs_updated_at
before update on public.engagement_activation_runs
for each row execute function public.set_updated_at();

alter table public.return_release_controls
  add column if not exists require_filing_acceptance boolean not null default false,
  add column if not exists filing_satisfied_at timestamptz,
  add column if not exists blockers jsonb not null default '[]'::jsonb,
  add column if not exists evaluated_at timestamptz;

-- Seed reusable system templates. Firms can duplicate and replace any of them.
do $seed$
declare
  v_letter_template_id uuid;
  v_letter_version_id uuid;
  v_individual_docs_template_id uuid;
  v_individual_docs_version_id uuid;
  v_individual_request_template_id uuid;
  v_business_docs_template_id uuid;
  v_business_docs_version_id uuid;
  v_business_request_template_id uuid;
begin
  select id into v_letter_template_id from public.templates
  where metadata->>'system_key'='verexa_default_tax_engagement_letter_v1' limit 1;

  if v_letter_template_id is null then
    insert into public.templates(
      kind,name,description,category,visibility,status,is_system_template,
      is_required,allow_workspace_customization,metadata,published_at
    ) values (
      'engagement','Verexa Default Tax Preparation Engagement Letter',
      'Customizable starter engagement letter for tax-preparation service packages.',
      'Engagement Letters','marketplace','published',true,false,true,
      '{"system_key":"verexa_default_tax_engagement_letter_v1","intended_use":"tax_engagement_letter","requires_firm_review":true}'::jsonb,
      now()
    ) returning id into v_letter_template_id;

    insert into public.template_versions(
      template_id,version_number,status,name,description,content,published_at
    ) values (
      v_letter_template_id,1,'published','Verexa Default Tax Preparation Engagement Letter',
      'Starter wording that each firm should review and customize before client use.',
      jsonb_build_object(
        'body_html',
        '<h1>Tax Preparation Engagement</h1><p>This letter confirms the tax preparation services requested by <strong>{{client_name}}</strong> for the <strong>{{tax_year}}</strong> tax year.</p><h2>Scope of services</h2><p>The firm will prepare the return identified as {{return_type}} using information supplied by the client. The client is responsible for providing complete and accurate information and for reviewing the completed return before filing.</p><h2>Documents and communication</h2><p>Requested information and documents must be provided through the secure client portal. The firm may request clarification or additional documentation when needed.</p><h2>Fees</h2><p>Fees are based on the accepted quote or other written pricing arrangement. Additional work outside the agreed scope may require a client-approved change order.</p><h2>Filing and payment</h2><p>Tax return filing deadlines do not extend the deadline to pay tax due. The client remains responsible for timely payment of all taxes, estimates, penalties, and interest.</p><h2>Authorization</h2><p>Submitting this letter indicates agreement with the described scope and the firm''s published policies.</p>',
        'starter_notice','This is a customizable starter template and should be reviewed by the firm before publication.'
      ),
      now()
    ) returning id into v_letter_version_id;

    update public.templates set current_version_id=v_letter_version_id,
      latest_published_version_id=v_letter_version_id where id=v_letter_template_id;
  else
    select coalesce(latest_published_version_id,current_version_id) into v_letter_version_id
    from public.templates where id=v_letter_template_id;
  end if;

  select id into v_individual_docs_template_id from public.templates
  where metadata->>'system_key'='verexa_individual_tax_document_request_v1' limit 1;

  if v_individual_docs_template_id is null then
    insert into public.templates(kind,name,description,category,visibility,status,is_system_template,is_required,allow_workspace_customization,metadata,published_at)
    values('document_request','Individual Tax Document Checklist','Starter document checklist for Form 1040 and amended individual returns.','Document Requests','marketplace','published',true,false,true,
      '{"system_key":"verexa_individual_tax_document_request_v1","intended_use":"tax_document_request","tax_form":"1040"}'::jsonb,now())
    returning id into v_individual_docs_template_id;
    insert into public.template_versions(template_id,version_number,status,name,description,content,published_at)
    values(v_individual_docs_template_id,1,'published','Individual Tax Document Checklist','Reusable individual-return document checklist','{}'::jsonb,now())
    returning id into v_individual_docs_version_id;
    update public.templates set current_version_id=v_individual_docs_version_id,latest_published_version_id=v_individual_docs_version_id
      where id=v_individual_docs_template_id;
  else
    select coalesce(latest_published_version_id,current_version_id) into v_individual_docs_version_id
    from public.templates where id=v_individual_docs_template_id;
  end if;

  select id into v_individual_request_template_id from public.document_request_templates
  where template_id=v_individual_docs_template_id and template_version_id=v_individual_docs_version_id limit 1;
  if v_individual_request_template_id is null then
    insert into public.document_request_templates(template_id,template_version_id,title,default_client_message,default_due_days,settings)
    values(v_individual_docs_template_id,v_individual_docs_version_id,'Tax documents needed',
      'Please upload the documents that apply to your return through the secure portal.',7,
      '{"system_key":"verexa_individual_tax_document_request_v1"}'::jsonb)
    returning id into v_individual_request_template_id;
    insert into public.document_request_template_items(request_template_id,document_label,description,is_required,sort_order)
    values
      (v_individual_request_template_id,'Government-issued photo identification','For each taxpayer on the return.',true,10),
      (v_individual_request_template_id,'Social Security cards or ITIN documentation','For taxpayers and dependents when requested by the firm.',true,20),
      (v_individual_request_template_id,'Income documents','W-2, 1099, K-1, unemployment, retirement, Social Security, and other income forms that apply.',true,30),
      (v_individual_request_template_id,'Prior-year tax return','Most recently filed federal and state returns.',false,40),
      (v_individual_request_template_id,'Deduction and credit documents','Education, childcare, mortgage, charitable, medical, energy, and other records that apply.',false,50),
      (v_individual_request_template_id,'State and local tax documents','Documents for every state or locality involved.',false,60);
  end if;

  select id into v_business_docs_template_id from public.templates
  where metadata->>'system_key'='verexa_business_tax_document_request_v1' limit 1;

  if v_business_docs_template_id is null then
    insert into public.templates(kind,name,description,category,visibility,status,is_system_template,is_required,allow_workspace_customization,metadata,published_at)
    values('document_request','Business Tax Document Checklist','Starter checklist for Forms 1065, 1120, 1120-S, and 990.','Document Requests','marketplace','published',true,false,true,
      '{"system_key":"verexa_business_tax_document_request_v1","intended_use":"tax_document_request","entity_scope":"business"}'::jsonb,now())
    returning id into v_business_docs_template_id;
    insert into public.template_versions(template_id,version_number,status,name,description,content,published_at)
    values(v_business_docs_template_id,1,'published','Business Tax Document Checklist','Reusable business-return document checklist','{}'::jsonb,now())
    returning id into v_business_docs_version_id;
    update public.templates set current_version_id=v_business_docs_version_id,latest_published_version_id=v_business_docs_version_id
      where id=v_business_docs_template_id;
  else
    select coalesce(latest_published_version_id,current_version_id) into v_business_docs_version_id
    from public.templates where id=v_business_docs_template_id;
  end if;

  select id into v_business_request_template_id from public.document_request_templates
  where template_id=v_business_docs_template_id and template_version_id=v_business_docs_version_id limit 1;
  if v_business_request_template_id is null then
    insert into public.document_request_templates(template_id,template_version_id,title,default_client_message,default_due_days,settings)
    values(v_business_docs_template_id,v_business_docs_version_id,'Business tax documents needed',
      'Please upload the records that apply to this business return through the secure portal.',10,
      '{"system_key":"verexa_business_tax_document_request_v1"}'::jsonb)
    returning id into v_business_request_template_id;
    insert into public.document_request_template_items(request_template_id,document_label,description,is_required,sort_order)
    values
      (v_business_request_template_id,'Prior-year business tax return','Most recently filed federal and state returns.',true,10),
      (v_business_request_template_id,'Year-end profit and loss statement','Final statement covering the complete tax year.',true,20),
      (v_business_request_template_id,'Year-end balance sheet','Final balance sheet covering the complete tax year.',true,30),
      (v_business_request_template_id,'General ledger and trial balance','Detailed accounting records when maintained.',false,40),
      (v_business_request_template_id,'Payroll and contractor reports','Payroll summaries, Forms W-2/W-3, 1099s, and related filings.',false,50),
      (v_business_request_template_id,'Ownership and officer changes','Details of changes during the tax year.',false,60),
      (v_business_request_template_id,'Asset purchases and disposals','Invoices, closing statements, trade-in details, and sale records.',false,70),
      (v_business_request_template_id,'State and local filings','Documents for every state or locality involved.',false,80);
  end if;
end
$seed$;

create or replace function private.ensure_workspace_tax_service_packages(p_workspace_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workflow_definition_id uuid;
  v_letter_template_id uuid;
  v_letter_version_id uuid;
  v_individual_docs_template_id uuid;
  v_individual_docs_version_id uuid;
  v_business_docs_template_id uuid;
  v_business_docs_version_id uuid;
  v_tasks jsonb := '[
    {"key":"review_intake","title":"Review organizer and submitted documents","task_type":"intake_review","assigned_role":"responsible_staff","due_offset_days":3},
    {"key":"prepare_return","title":"Prepare tax return","task_type":"tax_preparation","assigned_role":"preparer","due_offset_days":7},
    {"key":"quality_review","title":"Review completed tax return","task_type":"tax_review","assigned_role":"reviewer","requires_review":true,"due_offset_days":10},
    {"key":"finalize_delivery","title":"Confirm filing status and release requirements","task_type":"return_delivery","assigned_role":"responsible_staff","due_offset_days":14}
  ]'::jsonb;
  v_messages jsonb := '{
    "portal_invite_subject":"Your secure Verexa portal is ready",
    "intake_subject":"Your tax organizer and document request are ready",
    "engagement_letter_subject":"Please review your tax engagement letter"
  }'::jsonb;
  v_reminders jsonb := '{"intake_days":[3,7,14],"documents_days":[3,7,14],"signature_days":[2,5],"payment_days":[2,5]}'::jsonb;
begin
  if p_workspace_id is null then return; end if;

  select d.id into v_workflow_definition_id
  from public.workflow_definitions d
  join public.templates t on t.id=d.template_id
  where d.is_active and t.metadata->>'system_key'='verexa_default_tax_workflow_v1'
  order by d.created_at limit 1;

  select id,coalesce(latest_published_version_id,current_version_id)
  into v_letter_template_id,v_letter_version_id from public.templates
  where metadata->>'system_key'='verexa_default_tax_engagement_letter_v1' limit 1;

  select id,coalesce(latest_published_version_id,current_version_id)
  into v_individual_docs_template_id,v_individual_docs_version_id from public.templates
  where metadata->>'system_key'='verexa_individual_tax_document_request_v1' limit 1;

  select id,coalesce(latest_published_version_id,current_version_id)
  into v_business_docs_template_id,v_business_docs_version_id from public.templates
  where metadata->>'system_key'='verexa_business_tax_document_request_v1' limit 1;

  insert into public.engagement_type_settings(
    workspace_id,engagement_type,return_type,name,primary_workflow_definition_id,
    organizer_template_id,organizer_template_version_id,
    engagement_letter_template_id,engagement_letter_template_version_id,
    document_checklist_template_id,document_checklist_template_version_id,
    pricing_method,reviewer_policy,default_tasks,default_messages,reminder_settings,
    invoice_settings,release_settings,portal_settings
  )
  select p_workspace_id,x.engagement_type::public.engagement_type,x.return_type::public.tax_return_type,x.name,
    v_workflow_definition_id,
    o.id,coalesce(o.latest_published_version_id,o.current_version_id),
    v_letter_template_id,v_letter_version_id,
    case when x.return_type in ('1040','1040-X') then v_individual_docs_template_id else v_business_docs_template_id end,
    case when x.return_type in ('1040','1040-X') then v_individual_docs_version_id else v_business_docs_version_id end,
    'staff_entered','auto_ero',v_tasks,v_messages,v_reminders,
    '{"create_on_activation":false,"due_days":0}'::jsonb,
    '{"require_payment":true,"require_signature":true,"require_review_approval":true,"require_filing_acceptance":false}'::jsonb,
    '{"invite_on_send":true}'::jsonb
  from (values
    ('individual_return','1040','Individual Tax Preparation'),
    ('business_return','1065','Partnership Tax Preparation'),
    ('business_return','1120','C Corporation Tax Preparation'),
    ('business_return','1120-S','S Corporation Tax Preparation'),
    ('business_return','990','Nonprofit Tax Preparation'),
    ('amended_return','1040-X','Amended Individual Return')
  ) as x(engagement_type,return_type,name)
  left join lateral (
    select t.* from public.templates t
    where t.kind='form' and t.status='published'
      and (
        t.metadata->>'tax_form'=case when x.return_type='1040-X' then '1040' else x.return_type end
        or (x.return_type='1040' and t.metadata->>'tax_form'='1040')
      )
    order by case when t.metadata->>'intended_use' in ('tax_organizer','tax_preparation_intake') then 0 else 1 end,t.created_at
    limit 1
  ) o on true
  on conflict (workspace_id,engagement_type,return_type) do update set
    primary_workflow_definition_id=coalesce(public.engagement_type_settings.primary_workflow_definition_id,excluded.primary_workflow_definition_id),
    organizer_template_id=coalesce(public.engagement_type_settings.organizer_template_id,excluded.organizer_template_id),
    organizer_template_version_id=coalesce(public.engagement_type_settings.organizer_template_version_id,excluded.organizer_template_version_id),
    engagement_letter_template_id=coalesce(public.engagement_type_settings.engagement_letter_template_id,excluded.engagement_letter_template_id),
    engagement_letter_template_version_id=coalesce(public.engagement_type_settings.engagement_letter_template_version_id,excluded.engagement_letter_template_version_id),
    document_checklist_template_id=coalesce(public.engagement_type_settings.document_checklist_template_id,excluded.document_checklist_template_id),
    document_checklist_template_version_id=coalesce(public.engagement_type_settings.document_checklist_template_version_id,excluded.document_checklist_template_version_id),
    default_tasks=case when public.engagement_type_settings.default_tasks='[]'::jsonb then excluded.default_tasks else public.engagement_type_settings.default_tasks end,
    default_messages=case when public.engagement_type_settings.default_messages='{}'::jsonb then excluded.default_messages else public.engagement_type_settings.default_messages end,
    reminder_settings=case when public.engagement_type_settings.reminder_settings='{}'::jsonb then excluded.reminder_settings else public.engagement_type_settings.reminder_settings end,
    invoice_settings=case when public.engagement_type_settings.invoice_settings='{"create_on_activation":false}'::jsonb then excluded.invoice_settings else public.engagement_type_settings.invoice_settings end,
    release_settings=case when public.engagement_type_settings.release_settings='{"require_payment":true,"require_signature":true,"require_review_approval":true,"require_filing_acceptance":false}'::jsonb then excluded.release_settings else public.engagement_type_settings.release_settings end,
    portal_settings=case when public.engagement_type_settings.portal_settings='{"invite_on_send":true}'::jsonb then excluded.portal_settings else public.engagement_type_settings.portal_settings end,
    updated_at=now();
end;
$$;

revoke all on function private.ensure_workspace_tax_service_packages(uuid) from public,anon,authenticated;

create or replace function private.seed_workspace_tax_service_packages_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.workspace_type <> 'platform_admin' then
    perform private.ensure_workspace_tax_service_packages(new.id);
  end if;
  return new;
end;
$$;

revoke all on function private.seed_workspace_tax_service_packages_trigger() from public,anon,authenticated;

drop trigger if exists workspaces_seed_tax_service_packages on public.workspaces;
create trigger workspaces_seed_tax_service_packages
after insert on public.workspaces
for each row execute function private.seed_workspace_tax_service_packages_trigger();

do $existing$
declare v_workspace_id uuid;
begin
  for v_workspace_id in select id from public.workspaces where workspace_type <> 'platform_admin'
  loop
    perform private.ensure_workspace_tax_service_packages(v_workspace_id);
  end loop;
end
$existing$;

create or replace function public.activate_tax_engagement(
  p_engagement_id uuid,
  p_activation_mode text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_engagement public.tax_engagements%rowtype;
  v_client public.clients%rowtype;
  v_setting public.engagement_type_settings%rowtype;
  v_activation public.engagement_activation_runs%rowtype;
  v_mode text;
  v_body_html text;
  v_doc_template public.document_request_templates%rowtype;
  v_task jsonb;
  v_task_assignee uuid;
  v_quote public.client_quotes%rowtype;
  v_invoice_amount numeric(12,2);
  v_invoice_number text;
  v_job_id uuid;
  v_current_stage text;
  v_warnings jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_engagement from public.tax_engagements where id=p_engagement_id for update;
  if not found then raise exception 'Engagement not found'; end if;
  if not public.can_manage_engagement(v_engagement.id) and not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select * into v_client from public.clients
  where id=v_engagement.client_id and workspace_id=v_engagement.workspace_id;
  if not found then raise exception 'Engagement client not found'; end if;

  if v_engagement.engagement_type_setting_id is null then
    perform private.ensure_workspace_tax_service_packages(v_engagement.workspace_id);
    select * into v_setting from public.engagement_type_settings s
    where s.workspace_id=v_engagement.workspace_id and s.engagement_type=v_engagement.engagement_type
      and (s.return_type=v_engagement.return_type or s.return_type is null) and s.is_active
    order by (s.return_type is not null) desc limit 1;
    update public.tax_engagements set engagement_type_setting_id=v_setting.id where id=v_engagement.id;
  else
    select * into v_setting from public.engagement_type_settings where id=v_engagement.engagement_type_setting_id;
  end if;
  if v_setting.id is null then raise exception 'No active service package is configured for this engagement'; end if;

  v_mode := coalesce(p_activation_mode,
    case v_setting.activation_default
      when 'activate_without_sending' then 'activate_without_sending'
      when 'activate_and_send' then 'activate_and_send'
      else null
    end);
  if v_mode='activate_only' then v_mode:='activate_without_sending'; end if;
  if v_mode not in ('activate_without_sending','activate_and_send') then
    raise exception 'Choose activate_without_sending or activate_and_send';
  end if;

  insert into public.engagement_activation_runs(
    workspace_id,engagement_id,engagement_type_setting_id,activation_mode,activated_by
  ) values(v_engagement.workspace_id,v_engagement.id,v_setting.id,v_mode,auth.uid())
  on conflict (engagement_id) do update set
    activation_mode=case
      when public.engagement_activation_runs.activation_mode='activate_and_send' then 'activate_and_send'
      else excluded.activation_mode end,
    engagement_type_setting_id=coalesce(public.engagement_activation_runs.engagement_type_setting_id,excluded.engagement_type_setting_id),
    updated_at=now()
  returning * into v_activation;

  -- Organizer: one immutable assignment per engagement/template version.
  if v_setting.organizer_template_id is not null and v_setting.organizer_template_version_id is not null then
    insert into public.intake_submissions(
      workspace_id,client_id,engagement_id,household_id,template_id,template_version_id,
      tax_year,assigned_by,due_date,metadata
    ) values(
      v_engagement.workspace_id,v_engagement.client_id,v_engagement.id,v_engagement.household_id,
      v_setting.organizer_template_id,v_setting.organizer_template_version_id,
      v_engagement.tax_year,auth.uid(),v_engagement.due_date,
      jsonb_build_object('source','engagement_activation','activation_id',v_activation.id)
    )
    on conflict (engagement_id,template_version_id) do update set
      due_date=coalesce(public.intake_submissions.due_date,excluded.due_date)
    returning id into v_activation.organizer_submission_id;

    insert into public.intake_answers(
      submission_id,workspace_id,field_id,field_key,answer_value,source,rolled_forward,confirmed_by_client
    )
    select v_activation.organizer_submission_id,v_engagement.workspace_id,f.id,f.field_key,
      to_jsonb(case f.field_key
        when 'contact_name' then coalesce(nullif(v_client.display_name,''),concat_ws(' ',v_client.first_name,v_client.last_name))
        when 'taxpayer_name' then coalesce(nullif(v_client.display_name,''),concat_ws(' ',v_client.first_name,v_client.last_name))
        when 'first_name' then v_client.first_name
        when 'last_name' then v_client.last_name
        when 'contact_email' then v_client.email
        when 'email' then v_client.email
        when 'contact_phone' then v_client.phone
        when 'phone' then v_client.phone
        when 'date_of_birth' then v_client.date_of_birth::text
        when 'ssn_last4' then v_client.ssn_last4
        when 'itin_last4' then v_client.itin_last4
        when 'legal_name' then coalesce(nullif(v_client.company,''),nullif(v_client.display_name,''),concat_ws(' ',v_client.first_name,v_client.last_name))
        when 'ein_last4' then v_client.ein_last4
        else null end),
      'client_profile',true,false
    from public.form_fields f
    where f.template_version_id=v_setting.organizer_template_version_id
      and f.field_key in ('contact_name','taxpayer_name','first_name','last_name','contact_email','email','contact_phone','phone','date_of_birth','ssn_last4','itin_last4','legal_name','ein_last4')
      and case f.field_key
        when 'contact_name' then coalesce(v_client.display_name,v_client.first_name)
        when 'taxpayer_name' then coalesce(v_client.display_name,v_client.first_name)
        when 'first_name' then v_client.first_name when 'last_name' then v_client.last_name
        when 'contact_email' then v_client.email when 'email' then v_client.email
        when 'contact_phone' then v_client.phone when 'phone' then v_client.phone
        when 'date_of_birth' then v_client.date_of_birth::text when 'ssn_last4' then v_client.ssn_last4
        when 'itin_last4' then v_client.itin_last4 when 'legal_name' then coalesce(v_client.company,v_client.display_name,v_client.first_name)
        when 'ein_last4' then v_client.ein_last4 else null end is not null
    on conflict do nothing;
  else
    v_warnings:=v_warnings||jsonb_build_array('organizer_not_configured');
  end if;

  -- Engagement letter: materialize the selected version once.
  if v_activation.engagement_letter_id is null and v_setting.engagement_letter_template_id is not null
     and v_setting.engagement_letter_template_version_id is not null then
    select coalesce(content->>'body_html',content->>'body','') into v_body_html
    from public.template_versions where id=v_setting.engagement_letter_template_version_id;
    v_body_html:=replace(v_body_html,'{{client_name}}',coalesce(nullif(v_client.display_name,''),concat_ws(' ',v_client.first_name,v_client.last_name)));
    v_body_html:=replace(v_body_html,'{{tax_year}}',coalesce(v_engagement.tax_year::text,''));
    v_body_html:=replace(v_body_html,'{{return_type}}',coalesce(v_engagement.return_type::text,v_engagement.engagement_type::text));
    insert into public.engagement_letters(
      workspace_id,client_id,engagement_id,template_id,title,body_html,version,status,created_by
    ) values(
      v_engagement.workspace_id,v_engagement.client_id,v_engagement.id,v_setting.engagement_letter_template_id,
      coalesce(v_engagement.tax_year::text||' ','')||'Tax Preparation Engagement',v_body_html,1,'draft',auth.uid()
    ) returning id into v_activation.engagement_letter_id;
  elsif v_setting.engagement_letter_template_id is null then
    v_warnings:=v_warnings||jsonb_build_array('engagement_letter_not_configured');
  end if;

  -- Document request: copy the selected checklist and its items once.
  if v_activation.document_request_id is null and v_setting.document_checklist_template_id is not null
     and v_setting.document_checklist_template_version_id is not null then
    select * into v_doc_template from public.document_request_templates
    where template_id=v_setting.document_checklist_template_id
      and template_version_id=v_setting.document_checklist_template_version_id limit 1;
    if v_doc_template.id is not null then
      insert into public.document_requests(
        workspace_id,client_id,engagement_id,template_id,template_version_id,title,client_message,
        status,due_date,created_by,assigned_to_user_id,reminder_settings,metadata
      ) values(
        v_engagement.workspace_id,v_engagement.client_id,v_engagement.id,
        v_setting.document_checklist_template_id,v_setting.document_checklist_template_version_id,
        v_doc_template.title,v_doc_template.default_client_message,'draft',
        case when v_doc_template.default_due_days is null then null else current_date+v_doc_template.default_due_days end,
        auth.uid(),coalesce(v_engagement.responsible_staff_user_id,v_engagement.primary_preparer_user_id),
        v_setting.reminder_settings,
        jsonb_build_object('source','engagement_activation','activation_id',v_activation.id)
      ) returning id into v_activation.document_request_id;

      insert into public.document_request_items(
        request_id,workspace_id,category_id,document_label,custom_label,description,is_required,
        minimum_files,maximum_files,allowed_mime_types,tax_year,sort_order,metadata
      )
      select v_activation.document_request_id,v_engagement.workspace_id,i.category_id,i.document_label,i.custom_label,
        i.description,i.is_required,i.minimum_files,i.maximum_files,i.allowed_mime_types,v_engagement.tax_year,
        i.sort_order,jsonb_build_object('source_template_item_id',i.id)
      from public.document_request_template_items i where i.request_template_id=v_doc_template.id;
    else
      v_warnings:=v_warnings||jsonb_build_array('document_checklist_definition_missing');
    end if;
  elsif v_setting.document_checklist_template_id is null then
    v_warnings:=v_warnings||jsonb_build_array('document_checklist_not_configured');
  end if;

  -- Service-package tasks. Metadata keys make the operation safely repeatable.
  for v_task in select value from jsonb_array_elements(coalesce(v_setting.default_tasks,'[]'::jsonb))
  loop
    if coalesce((v_task->>'requires_review')::boolean,false) and not v_engagement.review_required then continue; end if;
    v_task_assignee:=case v_task->>'assigned_role'
      when 'reviewer' then v_engagement.reviewer_user_id
      when 'preparer' then v_engagement.primary_preparer_user_id
      else coalesce(v_engagement.responsible_staff_user_id,v_engagement.primary_preparer_user_id,v_engagement.reviewer_user_id)
    end;
    if not exists (
      select 1 from public.tasks t where t.engagement_id=v_engagement.id
        and t.metadata->>'activation_task_key'=v_task->>'key'
    ) then
      insert into public.tasks(
        workspace_id,client_id,engagement_id,title,description,task_type,assigned_to_user_id,
        assigned_by_user_id,due_at,metadata,created_by
      ) values(
        v_engagement.workspace_id,v_engagement.client_id,v_engagement.id,v_task->>'title',v_task->>'description',
        v_task->>'task_type',v_task_assignee,auth.uid(),
        case when v_task ? 'due_offset_days' then now()+make_interval(days=>(v_task->>'due_offset_days')::int) else null end,
        jsonb_build_object('source','engagement_activation','activation_id',v_activation.id,'activation_task_key',v_task->>'key'),
        auth.uid()
      );
    end if;
  end loop;

  -- Create an invoice only when the package requests it and a final amount exists.
  if v_activation.invoice_id is null and coalesce((v_setting.invoice_settings->>'create_on_activation')::boolean,false) then
    select * into v_quote from public.client_quotes q
    where q.engagement_id=v_engagement.id and q.status='accepted' and q.quote_type='initial'
    order by q.accepted_at desc nulls last,q.created_at desc limit 1;
    v_invoice_amount:=coalesce(v_quote.amount,(v_setting.pricing_config->>'fixed_amount')::numeric);
    if v_invoice_amount is null then
      v_warnings:=v_warnings||jsonb_build_array('invoice_price_not_final');
    elsif public.has_workspace_role(v_engagement.workspace_id,array['owner','admin','ero','billing']::public.membership_role[])
       or public.is_platform_admin() then
      v_invoice_number:=public.next_invoice_number(v_engagement.workspace_id);
      insert into public.invoices(
        workspace_id,client_id,engagement_id,invoice_number,status,issue_date,due_date,currency,
        client_message,metadata,created_by
      ) values(
        v_engagement.workspace_id,v_engagement.client_id,v_engagement.id,v_invoice_number,'draft',current_date,
        current_date+coalesce((v_setting.invoice_settings->>'due_days')::int,0),'USD',
        'Invoice for '||v_engagement.title,
        jsonb_build_object('source','engagement_activation','activation_id',v_activation.id,'quote_id',v_quote.id),auth.uid()
      ) returning id into v_activation.invoice_id;
      insert into public.invoice_items(workspace_id,invoice_id,service_id,description,quantity,unit_price,discount_amount,tax_amount,sort_order)
      values(v_engagement.workspace_id,v_activation.invoice_id,v_engagement.service_id,v_engagement.title,1,v_invoice_amount,0,0,10);
    else
      v_warnings:=v_warnings||jsonb_build_array('invoice_requires_billing_permission');
    end if;
  end if;

  insert into public.return_release_controls(
    workspace_id,engagement_id,require_payment,require_signature,require_review_approval,require_filing_acceptance
  ) values(
    v_engagement.workspace_id,v_engagement.id,
    coalesce((v_setting.release_settings->>'require_payment')::boolean,true),
    coalesce((v_setting.release_settings->>'require_signature')::boolean,true),
    case when v_engagement.review_required then coalesce((v_setting.release_settings->>'require_review_approval')::boolean,true) else false end,
    coalesce((v_setting.release_settings->>'require_filing_acceptance')::boolean,false)
  ) on conflict (engagement_id) do update set
    require_payment=excluded.require_payment,require_signature=excluded.require_signature,
    require_review_approval=excluded.require_review_approval,require_filing_acceptance=excluded.require_filing_acceptance,
    updated_at=now();

  update public.clients set status='active',updated_at=now() where id=v_engagement.client_id;
  update public.tax_engagements set opened_at=coalesce(opened_at,now()),updated_at=now() where id=v_engagement.id;

  select current_stage_key into v_current_stage from public.engagement_workflow_instances where engagement_id=v_engagement.id;
  if v_current_stage='draft_engagement' then
    perform public.set_engagement_workflow_stage(v_engagement.id,'awaiting_activation','Engagement activation started');
    v_current_stage:='awaiting_activation';
  end if;
  if v_current_stage='awaiting_activation' then
    perform public.set_engagement_workflow_stage(v_engagement.id,'activated','Engagement activated');
    v_current_stage:='activated';
  end if;

  if v_mode='activate_and_send' then
    if v_client.email is null then
      v_warnings:=v_warnings||jsonb_build_array('client_email_missing');
    else
      if v_activation.portal_delivery_job_id is null then
        insert into public.automation_jobs(workspace_id,job_type,payload,status,scheduled_for,max_attempts)
        values(
          v_engagement.workspace_id,'deliver_engagement_activation_package',
          jsonb_build_object(
            'activation_id',v_activation.id,'engagement_id',v_engagement.id,'client_id',v_engagement.client_id,
            'recipient_email',v_client.email,'invite_portal',v_client.portal_user_id is null and coalesce((v_setting.portal_settings->>'invite_on_send')::boolean,true),
            'organizer_submission_id',v_activation.organizer_submission_id,
            'engagement_letter_id',v_activation.engagement_letter_id,
            'document_request_id',v_activation.document_request_id,'invoice_id',v_activation.invoice_id,
            'messages',v_setting.default_messages,'reminders',v_setting.reminder_settings
          ),'queued',now(),5
        ) returning id into v_job_id;
        v_activation.portal_delivery_job_id:=v_job_id;
      end if;

      if v_activation.organizer_submission_id is not null then
        update public.engagement_progress_trackers set intake_status='sent',updated_by=auth.uid(),updated_at=now()
          where engagement_id=v_engagement.id and intake_status='not_sent';
      end if;
      if v_activation.document_request_id is not null then
        update public.document_requests set status='sent',sent_at=coalesce(sent_at,now()),updated_at=now()
          where id=v_activation.document_request_id and status='draft';
        update public.engagement_progress_trackers set documents_status='requested',updated_by=auth.uid(),updated_at=now()
          where engagement_id=v_engagement.id and documents_status='not_requested';
      end if;
      if v_activation.engagement_letter_id is not null then
        update public.engagement_letters set status='sent',sent_at=coalesce(sent_at,now()),updated_at=now()
          where id=v_activation.engagement_letter_id and status='draft';
        update public.engagement_progress_trackers set engagement_letter_status='sent',updated_by=auth.uid(),updated_at=now()
          where engagement_id=v_engagement.id and engagement_letter_status='not_sent';
      end if;
      if v_activation.invoice_id is not null then
        update public.engagement_progress_trackers set payment_status='invoiced',updated_by=auth.uid(),updated_at=now()
          where engagement_id=v_engagement.id and payment_status='not_invoiced';
      end if;
      if v_current_stage='activated' then
        perform public.set_engagement_workflow_stage(v_engagement.id,'intake_documents_requested','Client package queued for delivery');
      end if;
    end if;
  end if;

  update public.engagement_activation_runs set
    engagement_type_setting_id=v_setting.id,activation_mode=v_mode,
    status=case when v_mode='activate_and_send' and v_activation.portal_delivery_job_id is not null then 'delivery_queued' else 'prepared' end,
    organizer_submission_id=v_activation.organizer_submission_id,
    engagement_letter_id=v_activation.engagement_letter_id,
    document_request_id=v_activation.document_request_id,
    invoice_id=v_activation.invoice_id,
    portal_delivery_job_id=v_activation.portal_delivery_job_id,
    artifacts=jsonb_strip_nulls(jsonb_build_object(
      'organizer_submission_id',v_activation.organizer_submission_id,
      'engagement_letter_id',v_activation.engagement_letter_id,
      'document_request_id',v_activation.document_request_id,
      'invoice_id',v_activation.invoice_id,
      'portal_delivery_job_id',v_activation.portal_delivery_job_id
    )),
    warnings=v_warnings,
    delivery_queued_at=case when v_activation.portal_delivery_job_id is not null then coalesce(delivery_queued_at,now()) else delivery_queued_at end,
    updated_at=now()
  where id=v_activation.id returning * into v_activation;

  perform public.log_engagement_activity(
    v_engagement.id,'engagement_activated','Engagement service package activated',null,v_mode,
    jsonb_build_object('activation_id',v_activation.id,'artifacts',v_activation.artifacts,'warnings',v_warnings)
  );

  return jsonb_build_object(
    'activation_id',v_activation.id,'engagement_id',v_engagement.id,'mode',v_activation.activation_mode,
    'status',v_activation.status,'artifacts',v_activation.artifacts,'warnings',v_activation.warnings
  );
end;
$$;

revoke all on function public.activate_tax_engagement(uuid,text) from public,anon;
grant execute on function public.activate_tax_engagement(uuid,text) to authenticated,service_role;

-- Replace the early release checker with explicit blockers and correct empty-set
-- behavior. No invoice is not the same thing as a paid invoice.
create or replace function public.evaluate_return_release(p_engagement_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_engagement public.tax_engagements%rowtype;
  v_control public.return_release_controls%rowtype;
  v_tracker public.engagement_progress_trackers%rowtype;
  v_invoice_count integer:=0;
  v_balance numeric:=0;
  v_payment_ok boolean;
  v_signature_ok boolean;
  v_review_ok boolean;
  v_filing_ok boolean;
  v_blockers jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_engagement from public.tax_engagements where id=p_engagement_id;
  if not found then raise exception 'Engagement not found'; end if;
  if not public.is_workspace_member(v_engagement.workspace_id) and not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select * into v_control from public.return_release_controls where engagement_id=p_engagement_id for update;
  if not found then
    insert into public.return_release_controls(
      workspace_id,engagement_id,require_payment,require_signature,require_review_approval
    ) values(v_engagement.workspace_id,v_engagement.id,true,true,v_engagement.review_required)
    returning * into v_control;
  end if;
  select * into v_tracker from public.engagement_progress_trackers where engagement_id=p_engagement_id;

  select count(*),coalesce(sum(greatest(balance_due,0)),0)
    into v_invoice_count,v_balance from public.invoices
  where engagement_id=p_engagement_id and status not in ('void','draft','refunded');

  v_payment_ok:=not v_control.require_payment
    or v_tracker.payment_status='waived'
    or (v_invoice_count>0 and v_balance=0 and exists(
      select 1 from public.invoices where engagement_id=p_engagement_id and status='paid'
    ));
  v_signature_ok:=not v_control.require_signature
    or v_tracker.signature_status='complete'
    or exists(select 1 from public.signature_requests where engagement_id=p_engagement_id and status='completed');
  v_review_ok:=not v_control.require_review_approval
    or not v_engagement.review_required
    or v_tracker.review_status='approved'
    or v_engagement.reviewed_at is not null;
  v_filing_ok:=not v_control.require_filing_acceptance
    or v_tracker.filing_status='accepted'
    or v_engagement.efile_status='accepted'
    or v_engagement.status='accepted';

  if not v_payment_ok then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object(
      'code',case when v_invoice_count=0 then 'payment_required_no_invoice' else 'payment_outstanding' end,
      'label',case when v_invoice_count=0 then 'Payment is required but no payable invoice exists.' else 'Payment is still outstanding.' end,
      'balance_due',v_balance));
  end if;
  if not v_signature_ok then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','signature_incomplete','label','Required signatures are incomplete.'));
  end if;
  if not v_review_ok then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','review_not_approved','label','Required review has not been approved.'));
  end if;
  if not v_filing_ok then
    v_blockers:=v_blockers||jsonb_build_array(jsonb_build_object('code','filing_not_accepted','label','The return has not been marked accepted.'));
  end if;

  update public.return_release_controls set
    payment_satisfied_at=case when v_payment_ok then coalesce(payment_satisfied_at,now()) else null end,
    signature_satisfied_at=case when v_signature_ok then coalesce(signature_satisfied_at,now()) else null end,
    review_satisfied_at=case when v_review_ok then coalesce(review_satisfied_at,now()) else null end,
    filing_satisfied_at=case when v_filing_ok then coalesce(filing_satisfied_at,now()) else null end,
    blockers=v_blockers,evaluated_at=now(),updated_at=now()
  where id=v_control.id returning * into v_control;

  return jsonb_build_object(
    'engagement_id',p_engagement_id,'can_release',jsonb_array_length(v_blockers)=0,
    'already_released',v_control.released_at is not null,'payment_ok',v_payment_ok,
    'signature_ok',v_signature_ok,'review_ok',v_review_ok,'filing_ok',v_filing_ok,
    'invoice_count',v_invoice_count,'balance_due',v_balance,'blockers',v_blockers,
    'evaluated_at',v_control.evaluated_at
  );
end;
$$;

revoke all on function public.evaluate_return_release(uuid) from public,anon;
grant execute on function public.evaluate_return_release(uuid) to authenticated,service_role;

drop function if exists public.release_completed_return(uuid,text);

create function public.release_completed_return(p_engagement_id uuid,p_notes text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_engagement public.tax_engagements%rowtype;
  v_control public.return_release_controls%rowtype;
  v_evaluation jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_engagement from public.tax_engagements where id=p_engagement_id for update;
  if not found then raise exception 'Engagement not found'; end if;
  if not public.can_manage_engagement(p_engagement_id) and not public.is_platform_admin() then
    raise exception 'Not authorized';
  end if;

  select * into v_control from public.return_release_controls where engagement_id=p_engagement_id for update;
  if v_control.released_at is not null then
    return jsonb_build_object('released',true,'already_released',true,'released_at',v_control.released_at,'released_by',v_control.released_by);
  end if;

  v_evaluation:=public.evaluate_return_release(p_engagement_id);
  if not coalesce((v_evaluation->>'can_release')::boolean,false) then
    raise exception 'Release requirements are not satisfied: %',v_evaluation->'blockers';
  end if;

  update public.return_release_controls set
    released_at=now(),released_by=auth.uid(),release_notes=nullif(btrim(p_notes),''),updated_at=now()
  where engagement_id=p_engagement_id returning * into v_control;
  update public.tax_engagements set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now()
    where id=p_engagement_id;

  perform public.log_engagement_activity(
    p_engagement_id,'completed_return_released','Completed return released to client',null,'released',
    jsonb_build_object('released_at',v_control.released_at,'release_notes',v_control.release_notes)
  );
  insert into public.audit_logs(workspace_id,actor_user_id,action,entity_type,entity_id,new_values)
  values(v_engagement.workspace_id,auth.uid(),'release_completed_return','tax_engagement',p_engagement_id::text,
    jsonb_build_object('released_at',v_control.released_at,'release_notes',v_control.release_notes));

  return jsonb_build_object('released',true,'already_released',false,'released_at',v_control.released_at,'released_by',v_control.released_by);
end;
$$;

revoke all on function public.release_completed_return(uuid,text) from public,anon;
grant execute on function public.release_completed_return(uuid,text) to authenticated,service_role;

commit;
