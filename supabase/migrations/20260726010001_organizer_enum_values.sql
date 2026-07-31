-- New enum values for the organizer's business/nonprofit/planning templates.
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as a statement
-- that references the new value, so this is its own migration file/transaction
-- (same pattern used in the engagement_schema_extension migration).

alter type public.form_component_type add value if not exists 'percentage';
alter type public.form_component_type add value if not exists 'acknowledgment';
alter type public.form_component_type add value if not exists 'year';

alter type public.intake_entity_type add value if not exists 'vehicle';
alter type public.intake_entity_type add value if not exists 'bank_account';
alter type public.intake_entity_type add value if not exists 'charitable_contribution';
alter type public.intake_entity_type add value if not exists 'business_owner';
alter type public.intake_entity_type add value if not exists 'fixed_asset';
alter type public.intake_entity_type add value if not exists 'state_filing';
