import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Client, TaxEngagement, DocumentRequest, IntakeSubmission } from "@/lib/types";

export type GlobalSearchResult = {
  clients: Client[];
  engagements: (TaxEngagement & { client: Client })[];
  intakes: (IntakeSubmission & { client: Client })[];
  documents: (DocumentRequest & { client: Client })[];
};

export async function globalSearch(
  supabase: SupabaseServerClient,
  workspaceId: string,
  q: string,
): Promise<GlobalSearchResult> {
  const term = q.trim();
  if (!term) {
    return { clients: [], engagements: [], intakes: [], documents: [] };
  }

  const escaped = term.replace(/[%,]/g, "");
  const ilike = `%${escaped}%`;

  const [clientsRes, engagementsRes, intakesRes, documentsRes] = await Promise.all([
    supabase
      .from("clients")
      .select("*")
      .eq("workspace_id", workspaceId)
      .or(
        [
          `first_name.ilike.${ilike}`,
          `last_name.ilike.${ilike}`,
          `display_name.ilike.${ilike}`,
          `company.ilike.${ilike}`,
          `email.ilike.${ilike}`,
        ].join(","),
      )
      .limit(5),
    supabase
      .from("tax_engagements")
      .select("*, client:clients(*)")
      .eq("workspace_id", workspaceId)
      .or(
        [
          `description.ilike.${ilike}`,
          `engagement_number.ilike.${ilike}`,
        ].join(","),
      )
      .limit(5),
    supabase
      .from("intake_submissions")
      .select("*, client:clients(*)")
      .eq("workspace_id", workspaceId)
      .or(
        [
          `status.ilike.${ilike}`,
        ].join(","),
      )
      .limit(5),
    supabase
      .from("document_requests")
      .select("*, client:clients(*)")
      .eq("workspace_id", workspaceId)
      .or(
        [
          `title.ilike.${ilike}`,
          `client_message.ilike.${ilike}`,
        ].join(","),
      )
      .limit(5),
  ]);

  return {
    clients: (clientsRes.data as Client[]) ?? [],
    engagements: (engagementsRes.data as GlobalSearchResult["engagements"]) ?? [],
    intakes: (intakesRes.data as GlobalSearchResult["intakes"]) ?? [],
    documents: (documentsRes.data as GlobalSearchResult["documents"]) ?? [],
  };
}
