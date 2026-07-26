"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePortalAccess } from "@/lib/auth/portal";
import { getDocumentSignedUrl } from "@/lib/data/portal-documents";
import {
  linkUploadedDocumentSchema,
  sanitizeFilename,
  DOCUMENTS_BUCKET,
  type LinkUploadedDocumentInput,
} from "@/lib/validation/portal-documents";

type ActionResult = { error?: string; documentId?: string };

/**
 * Builds the storage path the client is allowed to upload to: the
 * tax_client_documents_insert storage policy requires
 * {workspace_id}/{client_id}/... exactly, matched against the caller's own
 * linked client record — never trusted from the browser beyond the
 * filename itself.
 */
export async function getUploadPathPrefix(): Promise<
  { error: string } | { workspaceId: string; clientId: string; bucket: string }
> {
  const { client } = await requirePortalAccess();
  if (!client) return { error: "No linked client account." };
  return { workspaceId: client.client.workspace_id, clientId: client.client.id, bucket: DOCUMENTS_BUCKET };
}

export async function linkUploadedDocumentAction(
  input: LinkUploadedDocumentInput,
): Promise<ActionResult> {
  const parsed = linkUploadedDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid upload." };
  }

  const { client, user } = await requirePortalAccess();
  if (!client) return { error: "No linked client account." };

  const supabase = await createClient();

  // Storage path must actually belong to this client's own folder — the
  // storage INSERT policy already enforces this for the raw bytes, but the
  // documents row insert re-checks it explicitly rather than trusting the
  // path string alone.
  const expectedPrefix = `${client.client.workspace_id}/${client.client.id}/`;
  if (!parsed.data.storagePath.startsWith(expectedPrefix)) {
    return { error: "Upload path does not match your account." };
  }

  if (parsed.data.requestItemId) {
    const { data: item, error: itemError } = await supabase
      .from("document_request_items")
      .select("request_id")
      .eq("id", parsed.data.requestItemId)
      .maybeSingle();

    if (itemError || !item) {
      return { error: "That document request item was not found." };
    }

    const { data: request } = await supabase
      .from("document_requests")
      .select("client_id")
      .eq("id", item.request_id)
      .maybeSingle();

    if (!request || request.client_id !== client.client.id) {
      return { error: "That document request item was not found." };
    }
  }

  if (parsed.data.engagementId) {
    const { data: engagement } = await supabase
      .from("tax_engagements")
      .select("client_id")
      .eq("id", parsed.data.engagementId)
      .maybeSingle();
    if (!engagement || engagement.client_id !== client.client.id) {
      return { error: "That engagement was not found." };
    }
  }

  if (parsed.data.organizerSubmissionId) {
    const { data: submission } = await supabase
      .from("intake_submissions")
      .select("client_id")
      .eq("id", parsed.data.organizerSubmissionId)
      .maybeSingle();
    if (!submission || submission.client_id !== client.client.id) {
      return { error: "That organizer was not found." };
    }
  }

  const sanitizedName = sanitizeFilename(parsed.data.originalFilename);

  const { data: inserted, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: client.client.workspace_id,
      client_id: client.client.id,
      engagement_id: parsed.data.engagementId ?? null,
      request_item_id: parsed.data.requestItemId ?? null,
      category_id: parsed.data.categoryId ?? null,
      bucket_id: DOCUMENTS_BUCKET,
      storage_path: parsed.data.storagePath,
      original_filename: sanitizedName,
      display_name: parsed.data.displayName?.trim() || sanitizedName,
      mime_type: parsed.data.mimeType,
      file_size_bytes: parsed.data.fileSizeBytes,
      tax_year: parsed.data.taxYear ?? null,
      source: "client_upload",
      status: "uploaded",
      visibility: "client_and_staff",
    })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: "We couldn't save your upload. Please try again." };
  }

  if (parsed.data.organizerSubmissionId) {
    await supabase.from("document_links").insert({
      workspace_id: client.client.workspace_id,
      document_id: inserted.id,
      entity_type: "intake_submission",
      entity_id: parsed.data.organizerSubmissionId,
      linked_by: user.id,
    });
  }

  revalidatePath("/portal/documents");
  revalidatePath("/portal/document-requests");
  if (parsed.data.organizerSubmissionId) {
    revalidatePath(`/portal/organizer/${parsed.data.organizerSubmissionId}`);
  }

  return { documentId: inserted.id };
}

export async function getPortalDocumentUrlAction(documentId: string): Promise<{ url?: string; error?: string }> {
  const { client } = await requirePortalAccess();
  if (!client) return { error: "No linked client account." };

  const supabase = await createClient();
  const { data: document, error } = await supabase
    .from("documents")
    .select("bucket_id, storage_path, client_id")
    .eq("id", documentId)
    .eq("client_id", client.client.id)
    .maybeSingle();

  if (error || !document) return { error: "Document not found." };

  const url = await getDocumentSignedUrl(supabase, document.bucket_id, document.storage_path);
  if (!url) return { error: "We couldn't generate a link to this file." };

  return { url };
}
