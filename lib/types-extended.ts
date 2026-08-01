// Extended types for the comprehensive tax professional client schema
// These types will be merged into lib/types.ts after Supabase types are regenerated

import type { Database } from "@/types/database";
import type { Tables } from "@/lib/types";

export type ClientSpouse = Tables<"client_spouses">;
export type ClientDependent = Tables<"client_dependents">;
export type ClientBanking = Tables<"client_banking">;
export type ClientTaxHistory = Tables<"client_tax_history">;
export type ClientEmployment = Tables<"client_employment">;

export type FilingStatus = "single" | "mfj" | "mfs" | "hoh" | "qss";
export type AccountType = "checking" | "savings";
export type IncomeType = "w2" | "1099" | "business" | "rental" | "investment" | "retirement" | "other";
export type BusinessEntityType = "sole_prop" | "scorp" | "ccorp" | "partnership" | "llc";

// Extended ClientDetail with all new sections
export type ClientDetailExtended = {
  client: Tables<"clients">;
  contacts: Tables<"client_contacts">[];
  addresses: Tables<"client_addresses">[];
  spouse: ClientSpouse | null;
  dependents: ClientDependent[];
  banking: ClientBanking[];
  taxHistory: ClientTaxHistory[];
  employment: ClientEmployment[];
  intakeSubmissions: Tables<"intake_submissions">[];
  currentIntake: {
    submission: Tables<"intake_submissions">;
    household: Tables<"intake_household_people">[];
    income: Tables<"intake_income_sources">[];
    deductions: Tables<"intake_deductions_credits">[];
  } | null;
};
