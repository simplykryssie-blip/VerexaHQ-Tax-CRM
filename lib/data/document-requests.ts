import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Client, DocumentRequest, DocumentRequestItem, DocumentRequestStatus } from "@/lib/types";

export const DOCUMENT_REQUESTS_PAGE_SIZE = 20;

export type ItemStats = { total: number; received: number; outstanding: number };

const RECEIVED_ITEM_STATUSES = new Set(["uploaded", "under_review", "accepted", "waived"]);

export function computeItemStats(items: Pick<DocumentRequestItem, "status">[]): ItemStats {
  const total = items.length;
  const received = items.filter((item) => RECEIVED_ITEM_STATUSES.has(item.status)).length;
  return { total, received, outstanding: total - received };
}

async function getItemStatsByRequest(
  supabase: SupabaseServerClient,
  workspaceId: string,
  requestIds: string[],
) {
  const map = new Map<string, ItemStats>();
  if (requestIds.length === 0) return map;

  const { data } = await supabase
    .from("document_request_items")
    .select("request_id, status")
    .eq("workspace_id", workspaceId)
    .in("request_id", requestIds);

  const grouped = new Map<string, { status: string }[]>();
  for (const row of data ?? []) {
    const list = grouped.get(row.request_id) ?? [];
    list.push({ status: row.status });
    grouped.set(row.request_id, list);
  }

  for (const [requestId, rows] of grouped) {
    map.set(requestId, computeItemStats(rows as Pick<DocumentRequestItem, "status">[]));
  }
  return map;
}

export type DocumentRequestListItem = DocumentRequest & {
  client: Client | null;
  itemStats: ItemStats;
};

export type DocumentRequestListFilters = {
  q?: string;
  status?: DocumentRequestStatus;
  missingDocuments?: boolean;
  page?: number;
};

export async function listDocumentRequests(
  supabase: SupabaseServerClient,
  workspaceId: string,
  filters: DocumentRequestListFilters,
): Promise<{ requests: DocumentRequestListItem[]; total: number }> {
  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * DOCUMENT_REQUESTS_PAGE_SIZE;
  const to = from + DOCUMENT_REQUESTS_PAGE_SIZE - 1;

  let query = supabase
    .from("document_requests")
    .select("*, client:clients(*)", { count: "exact" })
    .eq("workspace_id", workspaceId);

  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.q) {
    const escaped = filters.q.trim().replace(/[%,]/g, "");
    if (escaped) {
      query = query.ilike("title", `%${escaped}%`);
    }
  }

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error || !data) return { requests: [], total: 0 };

  const statsMap = await getItemStatsByRequest(supabase, workspaceId, data.map((r) => r.id));

  let requests = data.map((request) => ({
    ...(request as DocumentRequest & { client: Client | null }),
    itemStats: statsMap.get(request.id) ?? { total: 0, received: 0, outstanding: 0 },
  }));

  if (filters.missingDocuments) {
    requests = requests.filter((r) => r.itemStats.outstanding > 0);
  }

  return { requests, total: count ?? 0 };
}

export async function listDocumentRequestsForClient(
  supabase: SupabaseServerClient,
  workspaceId: string,
  clientId: string,
): Promise<DocumentRequestListItem[]> {
  const { data, error } = await supabase
    .from("document_requests")
    .select("*, client:clients(*)")
    .eq("workspace_id", workspaceId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  const statsMap = await getItemStatsByRequest(supabase, workspaceId, data.map((r) => r.id));
  return data.map((request) => ({
    ...(request as DocumentRequest & { client: Client | null }),
    itemStats: statsMap.get(request.id) ?? { total: 0, received: 0, outstanding: 0 },
  }));
}

export type DocumentRequestDetail = {
  request: DocumentRequest;
  client: Client | null;
  items: DocumentRequestItem[];
};

export async function getDocumentRequestDetail(
  supabase: SupabaseServerClient,
  workspaceId: string,
  requestId: string,
): Promise<DocumentRequestDetail | null> {
  const { data: request, error } = await supabase
    .from("document_requests")
    .select("*, client:clients(*)")
    .eq("workspace_id", workspaceId)
    .eq("id", requestId)
    .maybeSingle();

  if (error || !request) return null;

  const { data: items } = await supabase
    .from("document_request_items")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("request_id", requestId)
    .order("sort_order", { ascending: true });

  const { client, ...requestRow } = request as DocumentRequest & { client: Client | null };

  return {
    request: requestRow,
    client,
    items: items ?? [],
  };
}
