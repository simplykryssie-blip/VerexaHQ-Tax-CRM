import type { SupabaseServerClient } from "@/lib/supabase/server";
import type {
  Client,
  ClientAddress,
  ClientContact,
  IntakeDeductionCredit,
  IntakeHouseholdPerson,
  IntakeIncomeSource,
  IntakeSubmission,
} from "@/lib/types";

export const CLIENTS_PAGE_SIZE = 20;

export type ClientListFilters = {
  q?: string;
  status?: string;
  page?: number;
};

export type ClientListItem = Client & {
  latestIntake: { status: IntakeSubmission["status"]; taxYear: number | null; updatedAt: string } | null;
};

export async function listClients(
  supabase: SupabaseServerClient,
  workspaceId: string,
  filters: ClientListFilters,
): Promise<{ clients: ClientListItem[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * CLIENTS_PAGE_SIZE;
  const to = from + CLIENTS_PAGE_SIZE - 1;

  let query = supabase
    .from("clients")
    .select("*", { count: "exact" })
    .eq("workspace_id", workspaceId);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  if (filters.q) {
    const term = filters.q.trim();
    if (term) {
      const escaped = term.replace(/[%,]/g, "");
      query = query.or(
        [
          `first_name.ilike.%${escaped}%`,
          `last_name.ilike.%${escaped}%`,
          `display_name.ilike.%${escaped}%`,
          `company.ilike.%${escaped}%`,
          `email.ilike.%${escaped}%`,
        ].join(","),
      );
    }
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error || !data) {
    return { clients: [], total: 0 };
  }

  const clientIds = data.map((c) => c.id);
  const latestByClient = await getLatestIntakePerClient(supabase, workspaceId, clientIds);

  return {
    clients: data.map((client) => ({
      ...client,
      latestIntake: latestByClient.get(client.id) ?? null,
    })),
    total: count ?? 0,
  };
}

async function getLatestIntakePerClient(
  supabase: SupabaseServerClient,
  workspaceId: string,
  clientIds: string[],
) {
  const map = new Map<
    string,
    { status: IntakeSubmission["status"]; taxYear: number | null; updatedAt: string }
  >();
  if (clientIds.length === 0) return map;

  const { data } = await supabase
    .from("intake_submissions")
    .select("client_id, status, tax_year, updated_at")
    .eq("workspace_id", workspaceId)
    .in("client_id", clientIds)
    .order("updated_at", { ascending: false });

  for (const row of data ?? []) {
    if (!map.has(row.client_id)) {
      map.set(row.client_id, {
        status: row.status,
        taxYear: row.tax_year,
        updatedAt: row.updated_at,
      });
    }
  }
  return map;
}

export type ClientDetail = {
  client: Client;
  contacts: ClientContact[];
  addresses: ClientAddress[];
  intakeSubmissions: IntakeSubmission[];
  currentIntake: {
    submission: IntakeSubmission;
    household: IntakeHouseholdPerson[];
    income: IntakeIncomeSource[];
    deductions: IntakeDeductionCredit[];
  } | null;
};

export async function getClientDetail(
  supabase: SupabaseServerClient,
  workspaceId: string,
  clientId: string,
): Promise<ClientDetail | null> {
  const { data: client, error } = await supabase
    .from("clients")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("id", clientId)
    .maybeSingle();

  if (error || !client) return null;

  const [contactsResult, addressesResult, submissionsResult] = await Promise.all([
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
  ]);

  const submissions = submissionsResult.data ?? [];
  const current = submissions[0] ?? null;

  let currentIntake: ClientDetail["currentIntake"] = null;
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
    intakeSubmissions: submissions,
    currentIntake,
  };
}
