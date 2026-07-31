import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { DocumentCategory, DocumentRequest, DocumentRequestItem, TaxEngagement } from "@/lib/types";

export type PortalRequestItem = DocumentRequestItem & { category: DocumentCategory | null };

export type PortalDocumentRequest = DocumentRequest & {
  engagement: Pick<TaxEngagement, "id" | "tax_year" | "title"> | null;
  items: PortalRequestItem[];
};

/**
 * A document request item is only shown as "missing" once it's truly
 * requested-and-nothing-given (status='requested'). Uploaded/under_review
 * means the client already acted; accepted/waived/not_applicable are done.
 */
export function isItemMissing(status: string) {
  return status === "requested";
}

export async function listPortalDocumentRequests(
  supabase: SupabaseServerClient,
  clientId: string,
): Promise<PortalDocumentRequest[]> {
  const { data, error } = await supabase
    .from("document_requests")
    .select("*, engagement:tax_engagements(id, tax_year, title)")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const requestIds = data.map((r) => r.id);
  const { data: items } = requestIds.length
    ? await supabase
        .from("document_request_items")
        .select("*, category:document_categories(*)")
        .in("request_id", requestIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const itemsByRequest = new Map<string, PortalRequestItem[]>();
  for (const item of (items ?? []) as PortalRequestItem[]) {
    const list = itemsByRequest.get(item.request_id) ?? [];
    list.push(item);
    itemsByRequest.set(item.request_id, list);
  }

  return data.map((request) => ({
    ...(request as unknown as DocumentRequest & {
      engagement: Pick<TaxEngagement, "id" | "tax_year" | "title"> | null;
    }),
    items: itemsByRequest.get(request.id) ?? [],
  }));
}

export async function getPortalDocumentRequestDetail(
  supabase: SupabaseServerClient,
  clientId: string,
  requestId: string,
): Promise<PortalDocumentRequest | null> {
  const { data: request, error } = await supabase
    .from("document_requests")
    .select("*, engagement:tax_engagements(id, tax_year, title)")
    // Ownership is verified explicitly (not just left to RLS) — a request
    // id from the URL is never trusted on its own.
    .eq("client_id", clientId)
    .eq("id", requestId)
    .maybeSingle();

  if (error || !request) return null;

  const { data: items } = await supabase
    .from("document_request_items")
    .select("*, category:document_categories(*)")
    .eq("request_id", requestId)
    .order("sort_order", { ascending: true });

  return {
    ...(request as unknown as DocumentRequest & {
      engagement: Pick<TaxEngagement, "id" | "tax_year" | "title"> | null;
    }),
    items: (items ?? []) as PortalRequestItem[],
  };
}

export async function countMissingDocuments(
  supabase: SupabaseServerClient,
  clientId: string,
): Promise<number> {
  const { data: requests } = await supabase
    .from("document_requests")
    .select("id")
    .eq("client_id", clientId)
    .not("status", "in", "(cancelled,expired)");

  const requestIds = (requests ?? []).map((r) => r.id);
  if (requestIds.length === 0) return 0;

  const { count } = await supabase
    .from("document_request_items")
    .select("id", { count: "exact", head: true })
    .in("request_id", requestIds)
    .eq("status", "requested");

  return count ?? 0;
}
