import type { IntakeEntityType } from "@/lib/types";

/**
 * Maps a repeatable form_sections.section_key to the intake_repeatable_entities
 * entity_type it corresponds to in the "Individual Tax Return Intake
 * Questionnaire" template. intake_answers has no way to represent multiple
 * instances of a section (one row per field_id per submission), so every
 * repeatable section's data is persisted in intake_repeatable_entities.data
 * instead — this map is what lets one generic renderer/action pair handle
 * all of them without hard-coding a bespoke form per section.
 */
export const REPEATABLE_SECTION_ENTITY_TYPE: Record<string, IntakeEntityType> = {
  employment_w2: "employer",
  retirement_benefits: "retirement_account",
  k1_income: "k1_entity",
  self_employment: "business",
  rental_properties: "rental_property",
  education_students: "education_student",
  childcare: "childcare_provider",
  investment_sales: "investment_sale",
  digital_assets: "digital_asset_account",
  property_sales: "property_sale",
  foreign_activity: "foreign_account",
  estimated_payments: "estimated_payment",
  tax_notices: "tax_notice",
};

/** The "dependents" section is repeatable but persisted via the dedicated intake_household_people table, not intake_repeatable_entities. */
export const HOUSEHOLD_SECTION_KEY = "dependents";

/** Never rendered client-side, regardless of individual field is_staff_only flags. */
export const STAFF_ONLY_SECTION_KEYS = ["staff_review"];
