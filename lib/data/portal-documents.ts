import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { DocumentCategory, DocumentRow, DocumentReview } from "@/lib/types";

export type PortalDocument = DocumentRow & {
  category: DocumentCategory | null;
  latestReview: Pick<DocumentReview, "status" | "client_message" | "reviewed_at"> | null;
};

export async function listPortalDocuments(
  supabase: SupabaseServerClient,
  clientId: string,
): Promise<PortalDocument[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*, category:document_categories(*)")
    .eq("client_id", clientId)
    .is("deleted_at", null)
    .eq("is_latest_version", true)
    .order("uploaded_at", { ascending: false });

  if (error || !data) return [];

  type ReviewSummary = Pick<DocumentReview, "document_id" | "status" | "client_message" | "reviewed_at" | "created_at">;

  const documentIds = data.map((d) => d.id);
  const { data: reviews } = documentIds.length
    ? await supabase
        .from("document_reviews")
        .select("document_id, status, client_message, reviewed_at, created_at")
        .in("document_id", documentIds)
        .order("created_at", { ascending: false })
    : { data: [] as ReviewSummary[] };

  const latestReviewByDocument = new Map<string, ReviewSummary>();
  for (const review of reviews ?? []) {
    if (!latestReviewByDocument.has(review.document_id)) {
      latestReviewByDocument.set(review.document_id, review);
    }
  }

  return data.map((doc) => ({
    ...(doc as unknown as DocumentRow & { category: DocumentCategory | null }),
    latestReview: latestReviewByDocument.get(doc.id) ?? null,
  }));
}

/** Short-lived signed URL for a private document the caller can already access via RLS. */
export async function getDocumentSignedUrl(
  supabase: SupabaseServerClient,
  bucketId: string,
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucketId).createSignedUrl(storagePath, 60 * 5);
  if (error || !data) return null;
  return data.signedUrl;
}
