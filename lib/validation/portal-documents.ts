import { z } from "zod";

export const DOCUMENTS_BUCKET = "tax-client-documents";

// Mirrors the tax-client-documents bucket's own allowed_mime_types/
// file_size_limit exactly (see supabase/migrations for the storage
// policies) — client-side validation here is a UX convenience; Storage
// itself is the real enforcement boundary and will reject anything else.
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const MAX_FILE_SIZE_BYTES = 52428800; // 50MB

export function sanitizeFilename(name: string): string {
  const trimmed = name.trim().slice(0, 180);
  // Strip path separators and control/special characters; keep letters,
  // numbers, spaces, dots, dashes, underscores and parentheses only.
  return trimmed.replace(/[^a-zA-Z0-9 ._()-]/g, "_") || "document";
}

export const linkUploadedDocumentSchema = z.object({
  storagePath: z.string().min(1),
  originalFilename: z.string().min(1).max(255),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
  requestItemId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  displayName: z.string().trim().max(200).optional(),
  taxYear: z.number().int().min(2000).max(2100).optional(),
});
export type LinkUploadedDocumentInput = z.infer<typeof linkUploadedDocumentSchema>;
