import type { SupabaseServerClient } from "@/lib/supabase/server";
import type {
  ClientSpouse,
  ClientDependent,
  ClientBanking,
  ClientTaxHistory,
  ClientEmployment,
  ClientDetailExtended,
} from "@/lib/types-extended";
import type {
  Client,
  ClientAddress,
  ClientContact,
  IntakeDeductionCredit,
  IntakeHouseholdPerson,
  IntakeIncomeSource,
  IntakeSubmission,
} from "@/lib/types";

/**
 * Load comprehensive client detail with all tax professional sections
 */
export async function getClientDetailExtended(
  supabase: SupabaseServerClient,
  workspaceId: string,
  clientId: string,
): Promise<ClientDetailExtended | null> {
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", clientId)
    .maybeSingle();

  if (error || !client) return null;

  const [
    contactsResult,
    addressesResult,
    submissionsResult,
    spouseResult,
    dependentsResult,
    bankingResult,
    taxHistoryResult,
    employmentResult,
  ] = await Promise.all([
    supabase
      .from("client_contacts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .order("is_primary", { ascending: false }),
    supabase
      .from("client_addresses")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .order("is_primary", { ascending: false }),
    supabase
      .from("intake_submissions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .order("tax_year", { ascending: false }),
    supabase
      .from("client_spouses")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .maybeSingle(),
    supabase
      .from("client_dependents")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .order("created_at", { ascending: true }),
    supabase
      .from("client_banking")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId),
    supabase
      .from("client_tax_history")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId)
      .order("tax_year", { ascending: false }),
    supabase
      .from("client_employment")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("client_id", clientId),
  ]);

  const submissions = submissionsResult.data ?? [];
  const current = submissions[0] ?? null;

  let currentIntake: ClientDetailExtended["currentIntake"] = null;
  if (current) {
    const [householdResult, incomeResult, deductionsResult] = await Promise.all([
      supabase
        .from("intake_household_people")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("submission_id", current.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("intake_income_sources")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("submission_id", current.id),
      supabase
        .from("intake_deductions_credits")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("submission_id", current.id),
    ]);

    currentIntake = {
      submission: current,
      household: householdResult.data ?? [],
      income: incomeResult.data ?? [],
      deductions: deductionsResult.data ?? [],
    };
  }

  return {
    client,
    contacts: contactsResult.data ?? [],
    addresses: addressesResult.data ?? [],
    spouse: spouseResult.data ?? null,
    dependents: dependentsResult.data ?? [],
    banking: bankingResult.data ?? [],
    taxHistory: taxHistoryResult.data ?? [],
    employment: employmentResult.data ?? [],
    intakeSubmissions: submissions,
    currentIntake,
  };
}

/**
 * Create or update client spouse information
 */
export async function upsertClientSpouse(
  supabase: SupabaseServerClient,
  workspaceId: string,
  clientId: string,
  data: Pick<ClientSpouse, "first_name" | "last_name"> & Partial<ClientSpouse>,
) {
  const { data: result, error } = await supabase
    .from("client_spouses")
    .upsert(
      {
        client_id: clientId,
        workspace_id: workspaceId,
        ...data,
      },
      { onConflict: "client_id" },
    )
    .select()
    .single();

  return { data: result, error };
}

/**
 * Create dependent
 */
export async function createClientDependent(
  supabase: SupabaseServerClient,
  workspaceId: string,
  clientId: string,
  data: Omit<ClientDependent, "id" | "client_id" | "workspace_id" | "created_at" | "updated_at">,
) {
  const { data: result, error } = await supabase
    .from("client_dependents")
    .insert({
      client_id: clientId,
      workspace_id: workspaceId,
      ...data,
    })
    .select()
    .single();

  return { data: result, error };
}

/**
 * Update dependent
 */
export async function updateClientDependent(
  supabase: SupabaseServerClient,
  dependentId: string,
  data: Partial<ClientDependent>,
) {
  const { data: result, error } = await supabase
    .from("client_dependents")
    .update(data)
    .eq("id", dependentId)
    .select()
    .single();

  return { data: result, error };
}

/**
 * Delete dependent
 */
export async function deleteClientDependent(supabase: SupabaseServerClient, dependentId: string) {
  const { error } = await supabase.from("client_dependents").delete().eq("id", dependentId);
  return { error };
}

/**
 * Create or update banking information
 */
export async function upsertClientBanking(
  supabase: SupabaseServerClient,
  workspaceId: string,
  clientId: string,
  data: Omit<ClientBanking, "client_id" | "workspace_id" | "created_at" | "updated_at">,
) {
  const { data: result, error } = await supabase
    .from("client_banking")
    .insert({
      client_id: clientId,
      workspace_id: workspaceId,
      ...data,
    })
    .select()
    .single();

  return { data: result, error };
}

/**
 * Create or update employment information
 */
export async function upsertClientEmployment(
  supabase: SupabaseServerClient,
  workspaceId: string,
  clientId: string,
  data: Omit<ClientEmployment, "client_id" | "workspace_id" | "created_at" | "updated_at">,
) {
  const { data: result, error } = await supabase
    .from("client_employment")
    .insert({
      client_id: clientId,
      workspace_id: workspaceId,
      ...data,
    })
    .select()
    .single();

  return { data: result, error };
}

/**
 * Create or update tax history record
 */
export async function upsertClientTaxHistory(
  supabase: SupabaseServerClient,
  workspaceId: string,
  clientId: string,
  taxYear: number,
  data: Omit<ClientTaxHistory, "id" | "client_id" | "workspace_id" | "tax_year" | "created_at" | "updated_at">,
) {
  const { data: result, error } = await supabase
    .from("client_tax_history")
    .upsert(
      {
        client_id: clientId,
        workspace_id: workspaceId,
        tax_year: taxYear,
        ...data,
      },
      { onConflict: "client_id,tax_year" },
    )
    .select()
    .single();

  return { data: result, error };
}
