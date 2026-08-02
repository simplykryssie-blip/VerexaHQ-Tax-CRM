-- Authoritative deadline rules for the filing years currently supported by
-- Verexa. Federal calendar-year rules are derived from IRS Publication 509 and
-- form instructions. State automation is activated only for verified rules;
-- every other jurisdiction is explicitly review_required rather than guessed.

begin;

create table public.tax_jurisdiction_rule_profiles (
  id uuid primary key default gen_random_uuid(),
  tax_year smallint not null check (tax_year between 2000 and 2100),
  return_type public.tax_return_type not null,
  jurisdiction text not null,
  rule_status text not null check (rule_status in ('calculated','not_applicable','review_required')),
  automatic_extension boolean not null default false,
  payment_due_with_original_return boolean not null default true,
  source_url text,
  source_label text,
  verified_on date,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tax_year,return_type,jurisdiction)
);

alter table public.tax_jurisdiction_rule_profiles enable row level security;
grant select on table public.tax_jurisdiction_rule_profiles to authenticated, service_role;
grant insert,update,delete on table public.tax_jurisdiction_rule_profiles to service_role;

create policy tax_jurisdiction_rule_profiles_member_select
on public.tax_jurisdiction_rule_profiles for select to authenticated
using (true);

create policy tax_jurisdiction_rule_profiles_platform_manage
on public.tax_jurisdiction_rule_profiles for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create trigger tax_jurisdiction_rule_profiles_updated_at
before update on public.tax_jurisdiction_rule_profiles
for each row execute function public.set_updated_at();

create unique index if not exists tax_deadline_rules_global_unique
on public.tax_deadline_rules(tax_year,return_type,jurisdiction)
where workspace_id is null;

-- Federal calendar-year rules. Special fiscal years, disaster relief, combat
-- zone relief, and taxpayer-specific postponements remain exception paths.
insert into public.tax_deadline_rules(
  workspace_id,tax_year,return_type,jurisdiction,original_due_date,extension_due_date,
  internal_lead_days,is_active,metadata
)
select null,v.tax_year,v.return_type::public.tax_return_type,'Federal',v.original_due_date,v.extension_due_date,14,true,
  jsonb_build_object(
    'authority','IRS','calendar_year_only',true,'extension_to_file_only',true,
    'source','https://www.irs.gov/publications/p509','source_label','IRS Publication 509',
    'verified_on','2026-08-01','requires_exception_review',true
  )
from (values
  (2025::smallint,'1040','2026-04-15'::date,'2026-10-15'::date),
  (2025::smallint,'709','2026-04-15'::date,'2026-10-15'::date),
  (2025::smallint,'1065','2026-03-16'::date,'2026-09-15'::date),
  (2025::smallint,'1120-S','2026-03-16'::date,'2026-09-15'::date),
  (2025::smallint,'1120','2026-04-15'::date,'2026-10-15'::date),
  (2025::smallint,'1041','2026-04-15'::date,'2026-09-30'::date),
  (2025::smallint,'990','2026-05-15'::date,'2026-11-16'::date),
  (2025::smallint,'940','2026-02-02'::date,null::date),
  (2026::smallint,'1040','2027-04-15'::date,'2027-10-15'::date),
  (2026::smallint,'709','2027-04-15'::date,'2027-10-15'::date),
  (2026::smallint,'1065','2027-03-15'::date,'2027-09-15'::date),
  (2026::smallint,'1120-S','2027-03-15'::date,'2027-09-15'::date),
  (2026::smallint,'1120','2027-04-15'::date,'2027-10-15'::date),
  (2026::smallint,'1041','2027-04-15'::date,'2027-09-30'::date),
  (2026::smallint,'990','2027-05-17'::date,'2027-11-15'::date),
  (2026::smallint,'940','2027-02-01'::date,null::date)
) v(tax_year,return_type,original_due_date,extension_due_date)
where not exists(
  select 1 from public.tax_deadline_rules r where r.workspace_id is null and r.tax_year=v.tax_year
    and r.return_type=v.return_type::public.tax_return_type and lower(r.jurisdiction)='federal'
);

-- Verified individual state rules.
insert into public.tax_deadline_rules(
  workspace_id,tax_year,return_type,jurisdiction,original_due_date,extension_due_date,
  internal_lead_days,is_active,metadata
)
select null,v.tax_year,'1040',v.jurisdiction,v.original_due_date,v.extension_due_date,14,true,
  jsonb_build_object(
    'authority','state','automatic_extension',v.automatic_extension,
    'extension_to_file_only',true,'source',v.source_url,'source_label',v.source_label,
    'verified_on','2026-08-01','calendar_year_only',true
  )
from (values
  (2025::smallint,'LA','2026-05-15'::date,'2026-11-16'::date,true,
    'https://revenue.louisiana.gov/news-and-announcements/2026/new-news%20%26%20announcement/','Louisiana Department of Revenue'),
  (2026::smallint,'LA','2027-05-17'::date,'2027-11-15'::date,true,
    'https://revenue.louisiana.gov/tax-education-and-faqs/faqs/individual-income-tax/what-is-the-due-date-of-the-individual-income-tax-return/','Louisiana Department of Revenue'),
  (2025::smallint,'VA','2026-05-01'::date,'2026-11-02'::date,true,
    'https://www.tax.virginia.gov/when-to-file','Virginia Tax'),
  (2026::smallint,'VA','2027-05-03'::date,'2027-11-01'::date,true,
    'https://www.tax.virginia.gov/when-to-file','Virginia Tax'),
  (2025::smallint,'HI','2026-04-20'::date,'2026-10-20'::date,false,
    'https://tax.hawaii.gov/tax-year-information/','Hawaii Department of Taxation'),
  (2026::smallint,'HI','2027-04-20'::date,'2027-10-20'::date,false,
    'https://tax.hawaii.gov/faq/','Hawaii Department of Taxation')
) v(tax_year,jurisdiction,original_due_date,extension_due_date,automatic_extension,source_url,source_label)
where not exists(
  select 1 from public.tax_deadline_rules r where r.workspace_id is null and r.tax_year=v.tax_year
    and r.return_type='1040' and r.jurisdiction=v.jurisdiction
);

-- Louisiana calendar-year partnership, corporate, S corporation, and fiduciary
-- rules use May 15 / November 15; the corporate extension depends on a timely
-- federal extension. Hawaii uses the 20th day of the 4th / 10th month.
insert into public.tax_deadline_rules(
  workspace_id,tax_year,return_type,jurisdiction,original_due_date,extension_due_date,
  internal_lead_days,is_active,metadata
)
select null,v.tax_year,v.return_type::public.tax_return_type,v.jurisdiction,v.original_due_date,v.extension_due_date,14,true,
  jsonb_build_object(
    'authority','state','automatic_extension',v.automatic_extension,'extension_to_file_only',true,
    'source',v.source_url,'source_label',v.source_label,'verified_on','2026-08-01','calendar_year_only',true
  )
from (values
  (2025::smallint,'1065','LA','2026-05-15'::date,'2026-11-16'::date,true,'https://revenue.louisiana.gov/tax-education-and-faqs/faqs/general-questions/can-i-request-a-state-income-tax-extension-if-i-am-unable-to-file-my-return-before-the-due-date/','Louisiana Department of Revenue'),
  (2025::smallint,'1120-S','LA','2026-05-15'::date,'2026-11-16'::date,true,'https://revenue.louisiana.gov/tax-education-and-faqs/faqs/general-questions/can-i-request-a-state-income-tax-extension-if-i-am-unable-to-file-my-return-before-the-due-date/','Louisiana Department of Revenue'),
  (2025::smallint,'1120','LA','2026-05-15'::date,'2026-11-16'::date,false,'https://revenue.louisiana.gov/tax-education-and-faqs/faqs/general-questions/can-i-request-a-state-income-tax-extension-if-i-am-unable-to-file-my-return-before-the-due-date/','Louisiana Department of Revenue'),
  (2025::smallint,'1041','LA','2026-05-15'::date,'2026-11-16'::date,true,'https://revenue.louisiana.gov/tax-education-and-faqs/faqs/general-questions/can-i-request-a-state-income-tax-extension-if-i-am-unable-to-file-my-return-before-the-due-date/','Louisiana Department of Revenue'),
  (2026::smallint,'1065','LA','2027-05-17'::date,'2027-11-15'::date,true,'https://revenue.louisiana.gov/tax-education-and-faqs/faqs/general-questions/can-i-request-a-state-income-tax-extension-if-i-am-unable-to-file-my-return-before-the-due-date/','Louisiana Department of Revenue'),
  (2026::smallint,'1120-S','LA','2027-05-17'::date,'2027-11-15'::date,true,'https://revenue.louisiana.gov/tax-education-and-faqs/faqs/general-questions/can-i-request-a-state-income-tax-extension-if-i-am-unable-to-file-my-return-before-the-due-date/','Louisiana Department of Revenue'),
  (2026::smallint,'1120','LA','2027-05-17'::date,'2027-11-15'::date,false,'https://revenue.louisiana.gov/tax-education-and-faqs/faqs/general-questions/can-i-request-a-state-income-tax-extension-if-i-am-unable-to-file-my-return-before-the-due-date/','Louisiana Department of Revenue'),
  (2026::smallint,'1041','LA','2027-05-17'::date,'2027-11-15'::date,true,'https://revenue.louisiana.gov/tax-education-and-faqs/faqs/general-questions/can-i-request-a-state-income-tax-extension-if-i-am-unable-to-file-my-return-before-the-due-date/','Louisiana Department of Revenue'),
  (2025::smallint,'1065','HI','2026-04-20'::date,'2026-10-20'::date,false,'https://tax.hawaii.gov/faq/','Hawaii Department of Taxation'),
  (2025::smallint,'1120-S','HI','2026-04-20'::date,'2026-10-20'::date,false,'https://tax.hawaii.gov/faq/','Hawaii Department of Taxation'),
  (2025::smallint,'1120','HI','2026-04-20'::date,'2026-10-20'::date,false,'https://tax.hawaii.gov/faq/','Hawaii Department of Taxation'),
  (2025::smallint,'1041','HI','2026-04-20'::date,'2026-10-20'::date,false,'https://tax.hawaii.gov/faq/','Hawaii Department of Taxation'),
  (2026::smallint,'1065','HI','2027-04-20'::date,'2027-10-20'::date,false,'https://tax.hawaii.gov/faq/','Hawaii Department of Taxation'),
  (2026::smallint,'1120-S','HI','2027-04-20'::date,'2027-10-20'::date,false,'https://tax.hawaii.gov/faq/','Hawaii Department of Taxation'),
  (2026::smallint,'1120','HI','2027-04-20'::date,'2027-10-20'::date,false,'https://tax.hawaii.gov/faq/','Hawaii Department of Taxation'),
  (2026::smallint,'1041','HI','2027-04-20'::date,'2027-10-20'::date,false,'https://tax.hawaii.gov/faq/','Hawaii Department of Taxation')
) v(tax_year,return_type,jurisdiction,original_due_date,extension_due_date,automatic_extension,source_url,source_label)
where not exists(
  select 1 from public.tax_deadline_rules r where r.workspace_id is null and r.tax_year=v.tax_year
    and r.return_type=v.return_type::public.tax_return_type and r.jurisdiction=v.jurisdiction
);

-- Every state/DC receives an explicit profile. Unsupported state-return
-- combinations are review_required, never silently treated as federal.
with jurisdictions(code) as (
  values ('AL'),('AK'),('AZ'),('AR'),('CA'),('CO'),('CT'),('DE'),('DC'),('FL'),('GA'),('HI'),
  ('ID'),('IL'),('IN'),('IA'),('KS'),('KY'),('LA'),('ME'),('MD'),('MA'),('MI'),('MN'),('MS'),
  ('MO'),('MT'),('NE'),('NV'),('NH'),('NJ'),('NM'),('NY'),('NC'),('ND'),('OH'),('OK'),('OR'),
  ('PA'),('RI'),('SC'),('SD'),('TN'),('TX'),('UT'),('VT'),('VA'),('WA'),('WV'),('WI'),('WY')
), years(tax_year) as (values (2025::smallint),(2026::smallint))
insert into public.tax_jurisdiction_rule_profiles(
  tax_year,return_type,jurisdiction,rule_status,automatic_extension,
  payment_due_with_original_return,source_url,source_label,verified_on,notes
)
select y.tax_year,'1040',j.code,
  case
    when j.code in ('AK','FL','NV','NH','SD','TN','TX','WA','WY') then 'not_applicable'
    when j.code in ('LA','VA','HI') then 'calculated'
    else 'review_required'
  end,
  j.code in ('LA','VA'),true,
  case j.code
    when 'LA' then 'https://revenue.louisiana.gov/tax-education-and-faqs/faqs/individual-income-tax/what-is-the-due-date-of-the-individual-income-tax-return/'
    when 'VA' then 'https://www.tax.virginia.gov/when-to-file'
    when 'HI' then 'https://tax.hawaii.gov/faq/'
    else null
  end,
  case when j.code='LA' then 'Louisiana Department of Revenue' when j.code='VA' then 'Virginia Tax' when j.code='HI' then 'Hawaii Department of Taxation' else null end,
  case when j.code in ('LA','VA','HI') then '2026-08-01'::date else null end,
  case
    when j.code in ('AK','FL','NV','NH','SD','TN','TX','WA','WY') then 'No general individual income tax return; special-purpose taxes may still require review.'
    when j.code in ('LA','VA','HI') then 'Calendar-year individual rule verified and activated.'
    else 'Official annual state rule must be verified before automatic calculation is enabled.'
  end
from jurisdictions j cross join years y
on conflict (tax_year,return_type,jurisdiction) do update set
  rule_status=excluded.rule_status,automatic_extension=excluded.automatic_extension,
  source_url=excluded.source_url,source_label=excluded.source_label,
  verified_on=excluded.verified_on,notes=excluded.notes,updated_at=now();

create or replace function private.sync_engagement_extended_deadlines()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.engagement_deadlines
  set is_active=new.extension_filed,updated_at=now()
  where engagement_id=new.id and deadline_type='extended_filing';
  update public.engagement_progress_trackers
  set extension_status=case when new.extension_filed then 'filed' else case when new.extension_requested then 'recommended' else 'not_needed' end end,
    updated_at=now()
  where engagement_id=new.id;
  return new;
end;
$$;

revoke all on function private.sync_engagement_extended_deadlines() from public,anon,authenticated;
create trigger tax_engagements_sync_extended_deadlines
after update of extension_requested,extension_filed on public.tax_engagements
for each row execute function private.sync_engagement_extended_deadlines();

commit;
