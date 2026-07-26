-- Seeds the six additional organizer templates required by Part 25, on top
-- of the existing "Individual Tax Return Intake Questionnaire" (already the
-- 1040 organizer). Each is a real public.templates/template_versions row
-- (kind='form', same system used by the individual organizer) with a lean,
-- data-driven set of form_sections/form_fields — reusing the same rendering
-- and answer-storage path (form_conditions/intake_document_rules/
-- intake_repeatable_entities) rather than a parallel schema.
--
-- Business organizer questions are intentionally shared across the three
-- business entity types (1120-S/1065/1120): at this lean, "useful but not
-- overwhelming" scope, an S corp, partnership, and C corp organizer ask
-- essentially the same collection questions. A helper function builds the
-- shared shape three times, then is dropped — it exists only to seed data
-- for this migration, not as an ongoing part of the schema.

create or replace function pg_temp.seed_business_organizer(
  p_name text,
  p_tax_form text,
  p_engagement_type text
) returns uuid
language plpgsql
as $$
declare
  v_template_id uuid;
  v_version_id uuid;
  v_sec uuid;
begin
  insert into public.templates (kind, name, category, visibility, status, is_system_template, metadata)
  values ('form', p_name, 'Tax Organizer', 'workspace', 'published', true,
    jsonb_build_object('tax_form', p_tax_form, 'engagement_type', p_engagement_type, 'intended_use', 'tax_organizer'))
  returning id into v_template_id;

  insert into public.template_versions (template_id, version_number, status, name, schema_version, content, published_at)
  values (v_template_id, 1, 'published', p_name, 1, '{}'::jsonb, now())
  returning id into v_version_id;

  update public.templates set current_version_id = v_version_id, latest_published_version_id = v_version_id
  where id = v_template_id;

  -- Entity information
  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Entity information', 'entity_information', 10) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'legal_name', 'text', 'Legal entity name', true, 1),
    (v_version_id, v_sec, 'ein_last4', 'text', 'EIN (last 4 digits)', true, 2),
    (v_version_id, v_sec, 'tax_year_end', 'date', 'Tax year end date', true, 3),
    (v_version_id, v_sec, 'accounting_method', 'single_choice', 'Accounting method', true, 4);
  update public.form_fields set options = '["Cash","Accrual"]'::jsonb where section_id = v_sec and field_key = 'accounting_method';

  -- Responsible contact
  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Responsible contact', 'responsible_contact', 20) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'contact_name', 'text', 'Responsible contact name', true, 1),
    (v_version_id, v_sec, 'contact_phone', 'phone', 'Phone', true, 2),
    (v_version_id, v_sec, 'contact_email', 'email', 'Email', true, 3);

  -- Business address
  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Business address', 'business_address', 30) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'business_address', 'address', 'Primary business address', true, 1);

  -- Ownership information (repeatable: business_owner)
  insert into public.form_sections (template_version_id, title, section_key, sort_order, is_repeatable)
  values (v_version_id, 'Ownership information', 'business_owners', 40, true) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'owner_name', 'text', 'Owner/shareholder/partner name', true, 1),
    (v_version_id, v_sec, 'ownership_percent', 'percentage', 'Ownership percentage', true, 2);

  -- Revenue
  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Revenue', 'business_revenue', 50) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'total_revenue', 'currency', 'Total revenue for the year', true, 1),
    (v_version_id, v_sec, 'revenue_notes', 'textarea', 'Anything unusual about this year''s revenue?', false, 2);

  -- Expenses
  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Expenses', 'business_expenses', 60) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'total_expenses', 'currency', 'Total expenses for the year', true, 1),
    (v_version_id, v_sec, 'expense_notes', 'textarea', 'Major expense categories or changes', false, 2);

  -- Payroll (conditional detail)
  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Payroll', 'business_payroll', 70) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'has_payroll', 'yes_no', 'Did the business run payroll this year?', true, 1),
    (v_version_id, v_sec, 'employee_count', 'number', 'Number of employees', false, 2),
    (v_version_id, v_sec, 'payroll_provider', 'text', 'Payroll provider', false, 3);
  insert into public.form_conditions (template_version_id, source_field_id, target_field_id, operator, comparison_value, action)
  select v_version_id, f1.id, f2.id, 'equals', 'true'::jsonb, 'show'
  from public.form_fields f1, public.form_fields f2
  where f1.section_id = v_sec and f1.field_key = 'has_payroll'
    and f2.section_id = v_sec and f2.field_key in ('employee_count','payroll_provider');

  -- Vehicles (repeatable)
  insert into public.form_sections (template_version_id, title, section_key, sort_order, is_repeatable)
  values (v_version_id, 'Vehicles', 'business_vehicles', 80, true) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'vehicle_description', 'text', 'Vehicle (year, make, model)', true, 1),
    (v_version_id, v_sec, 'business_use_percent', 'percentage', 'Business use percentage', true, 2);

  -- Bank accounts (repeatable)
  insert into public.form_sections (template_version_id, title, section_key, sort_order, is_repeatable)
  values (v_version_id, 'Bank accounts', 'business_bank_accounts', 90, true) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'bank_name', 'text', 'Bank name', true, 1),
    (v_version_id, v_sec, 'account_type', 'single_choice', 'Account type', true, 2);
  update public.form_fields set options = '["Checking","Savings","Line of credit"]'::jsonb where section_id = v_sec and field_key = 'account_type';

  -- State filings (repeatable)
  insert into public.form_sections (template_version_id, title, section_key, sort_order, is_repeatable)
  values (v_version_id, 'State filings', 'business_state_filings', 100, true) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'state', 'text', 'State', true, 1),
    (v_version_id, v_sec, 'filing_type', 'text', 'Filing type/registration', false, 2);

  -- Digital assets
  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Digital assets', 'business_digital_assets', 110) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'has_digital_assets', 'yes_no', 'Did the business receive, sell, or hold cryptocurrency or digital assets?', true, 1);

  -- Prior-year carryovers
  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Prior-year carryovers', 'business_carryovers', 120) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'carryover_notes', 'textarea', 'Any prior-year carryovers we should know about?', false, 1);

  -- Document uploads
  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Document uploads', 'document_uploads', 130) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'documents_uploaded', 'acknowledgment', 'I have uploaded my available documents in this section', false, 1);

  insert into public.intake_document_rules (template_version_id, source_field_key, operator, category_slug, document_label, is_required, priority)
  values
    (v_version_id, 'legal_name', 'is_not_empty', 'prior_year_return', 'Prior-year business tax return', true, 1),
    (v_version_id, 'total_revenue', 'is_not_empty', 'financial_statements', 'Year-end financial statements (P&L, balance sheet)', true, 2);

  return v_version_id;
end;
$$;

select pg_temp.seed_business_organizer('S Corporation 1120-S Organizer', '1120-S', 'business');
select pg_temp.seed_business_organizer('Partnership 1065 Organizer', '1065', 'business');
select pg_temp.seed_business_organizer('C Corporation 1120 Organizer', '1120', 'business');

drop function pg_temp.seed_business_organizer(text, text, text);

-- Nonprofit 990 organizer — shares the shape but with nonprofit-specific
-- labels (officers/board rather than owners, program activity rather than
-- generic revenue framing).
do $$
declare
  v_template_id uuid;
  v_version_id uuid;
  v_sec uuid;
begin
  insert into public.templates (kind, name, category, visibility, status, is_system_template, metadata)
  values ('form', 'Nonprofit 990 Organizer', 'Tax Organizer', 'workspace', 'published', true,
    jsonb_build_object('tax_form', '990', 'engagement_type', 'nonprofit', 'intended_use', 'tax_organizer'))
  returning id into v_template_id;

  insert into public.template_versions (template_id, version_number, status, name, schema_version, content, published_at)
  values (v_template_id, 1, 'published', 'Nonprofit 990 Organizer', 1, '{}'::jsonb, now())
  returning id into v_version_id;

  update public.templates set current_version_id = v_version_id, latest_published_version_id = v_version_id
  where id = v_template_id;

  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Organization information', 'entity_information', 10) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'legal_name', 'text', 'Legal organization name', true, 1),
    (v_version_id, v_sec, 'ein_last4', 'text', 'EIN (last 4 digits)', true, 2),
    (v_version_id, v_sec, 'mission_statement', 'textarea', 'Mission statement', true, 3);

  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Responsible contact', 'responsible_contact', 20) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'contact_name', 'text', 'Responsible contact name', true, 1),
    (v_version_id, v_sec, 'contact_phone', 'phone', 'Phone', true, 2),
    (v_version_id, v_sec, 'contact_email', 'email', 'Email', true, 3);

  insert into public.form_sections (template_version_id, title, section_key, sort_order, is_repeatable)
  values (v_version_id, 'Officers and board members', 'business_owners', 30, true) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'owner_name', 'text', 'Officer/board member name', true, 1),
    (v_version_id, v_sec, 'role_title', 'text', 'Title/role', true, 2);

  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Revenue', 'business_revenue', 40) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'total_revenue', 'currency', 'Total revenue for the year (contributions, grants, program revenue)', true, 1),
    (v_version_id, v_sec, 'revenue_notes', 'textarea', 'Major sources of revenue this year', false, 2);

  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Expenses', 'business_expenses', 50) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'total_expenses', 'currency', 'Total expenses for the year', true, 1),
    (v_version_id, v_sec, 'program_expense_notes', 'textarea', 'Program vs. administrative expense breakdown', false, 2);

  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Payroll', 'business_payroll', 60) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'has_payroll', 'yes_no', 'Did the organization run payroll this year?', true, 1),
    (v_version_id, v_sec, 'employee_count', 'number', 'Number of employees', false, 2);
  insert into public.form_conditions (template_version_id, source_field_id, target_field_id, operator, comparison_value, action)
  select v_version_id, f1.id, f2.id, 'equals', 'true'::jsonb, 'show'
  from public.form_fields f1, public.form_fields f2
  where f1.section_id = v_sec and f1.field_key = 'has_payroll'
    and f2.section_id = v_sec and f2.field_key = 'employee_count';

  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Document uploads', 'document_uploads', 70) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'documents_uploaded', 'acknowledgment', 'I have uploaded my available documents in this section', false, 1);

  insert into public.intake_document_rules (template_version_id, source_field_key, operator, category_slug, document_label, is_required, priority)
  values (v_version_id, 'legal_name', 'is_not_empty', 'prior_year_return', 'Prior-year Form 990', true, 1);
end;
$$;

-- Tax Planning organizer — deliberately light: this is a planning
-- engagement, not full return preparation.
do $$
declare
  v_template_id uuid;
  v_version_id uuid;
  v_sec uuid;
begin
  insert into public.templates (kind, name, category, visibility, status, is_system_template, metadata)
  values ('form', 'Tax Planning Organizer', 'Tax Organizer', 'workspace', 'published', true,
    jsonb_build_object('engagement_type', 'tax_planning', 'intended_use', 'tax_organizer'))
  returning id into v_template_id;

  insert into public.template_versions (template_id, version_number, status, name, schema_version, content, published_at)
  values (v_template_id, 1, 'published', 'Tax Planning Organizer', 1, '{}'::jsonb, now())
  returning id into v_version_id;

  update public.templates set current_version_id = v_version_id, latest_published_version_id = v_version_id
  where id = v_template_id;

  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Current picture', 'planning_current_picture', 10) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'estimated_income', 'currency', 'Estimated income this year', true, 1),
    (v_version_id, v_sec, 'income_change_notes', 'textarea', 'How has your income changed from last year?', false, 2);

  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Life changes', 'planning_life_changes', 20) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'life_changes', 'textarea', 'Any major life changes planned or expected? (marriage, home purchase, retirement, new business, etc.)', false, 1);

  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Goals and questions', 'planning_goals', 30) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'planning_goals', 'textarea', 'What would you like to accomplish with tax planning this year?', true, 1);

  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Document uploads', 'document_uploads', 40) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'documents_uploaded', 'acknowledgment', 'I have uploaded any relevant documents in this section', false, 1);
end;
$$;

-- Extension organizer — minimal by design: confirming what's needed to file
-- an extension, not a full organizer.
do $$
declare
  v_template_id uuid;
  v_version_id uuid;
  v_sec uuid;
begin
  insert into public.templates (kind, name, category, visibility, status, is_system_template, metadata)
  values ('form', 'Extension Organizer', 'Tax Organizer', 'workspace', 'published', true,
    jsonb_build_object('engagement_type', 'extension_only', 'intended_use', 'tax_organizer'))
  returning id into v_template_id;

  insert into public.template_versions (template_id, version_number, status, name, schema_version, content, published_at)
  values (v_template_id, 1, 'published', 'Extension Organizer', 1, '{}'::jsonb, now())
  returning id into v_version_id;

  update public.templates set current_version_id = v_version_id, latest_published_version_id = v_version_id
  where id = v_template_id;

  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Extension details', 'extension_details', 10) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'estimated_balance_due', 'currency', 'Estimated balance due (if any)', false, 1),
    (v_version_id, v_sec, 'estimated_refund', 'currency', 'Estimated refund (if any)', false, 2),
    (v_version_id, v_sec, 'extension_reason', 'textarea', 'Reason for requesting an extension', false, 3);

  insert into public.form_sections (template_version_id, title, section_key, sort_order)
  values (v_version_id, 'Confirmation', 'extension_confirmation', 20) returning id into v_sec;
  insert into public.form_fields (template_version_id, section_id, field_key, component_type, label, is_required, sort_order) values
    (v_version_id, v_sec, 'info_still_current', 'acknowledgment', 'My contact and address information on file is still current', true, 1);
end;
$$;
