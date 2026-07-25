"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { linkUploadedDocumentAction } from "@/lib/actions/portal-documents";
import {
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  DOCUMENTS_BUCKET,
  sanitizeFilename,
} from "@/lib/validation/portal-documents";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/Button";

export function DocumentUploadButton({
  workspaceId,
  clientId,
  requestItemId,
  categoryId,
  displayName,
  label = "Upload file",
  onUploaded,
}: {
  workspaceId: string;
  clientId: string;
  requestItemId?: string;
  categoryId?: string;
  displayName?: string;
  label?: string;
  onUploaded?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const router = useRouter();

  const handleFile = async (file: File) => {
    if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
      toast.error("That file type isn't supported. Please upload a PDF, JPG, PNG, HEIC, CSV, Excel, or Word file.");
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error("That file is too large. The maximum size is 50MB.");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const sanitized = sanitizeFilename(file.name);
      const storagePath = `${workspaceId}/${clientId}/${Date.now()}-${sanitized}`;

      const { error: uploadError } = await supabase.storage
        .from(DOCUMENTS_BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false });

      if (uploadError) {
        toast.error("Upload failed. Please try again.");
        return;
      }

      const result = await linkUploadedDocumentAction({
        storagePath,
        originalFilename: file.name,
        mimeType: file.type,
        fileSizeBytes: file.size,
        requestItemId,
        categoryId,
        displayName,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("File uploaded.");
      router.refresh();
      onUploaded?.();
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_MIME_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        {isUploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {isUploading ? "Uploading…" : label}
      </Button>
    </>
  );
}
