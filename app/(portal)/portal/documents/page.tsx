import { FolderOpen } from "lucide-react";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { listPortalDocuments } from "@/lib/data/portal-documents";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";

const REVIEW_LABELS: Record<string, { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }> = {
  pending: { label: "Awaiting review", tone: "info" },
  approved: { label: "Accepted", tone: "success" },
  rejected: { label: "Needs to be replaced", tone: "danger" },
  needs_clarification: { label: "Question from your tax office", tone: "warning" },
  duplicate: { label: "Duplicate", tone: "neutral" },
  illegible: { label: "Couldn't be read — please re-upload", tone: "danger" },
  wrong_document: { label: "Wrong document — please re-upload", tone: "danger" },
};

export default async function PortalDocumentsPage() {
  const { client } = await requirePortalAccess();
  if (!client) return <PortalNotLinkedState />;

  const supabase = await createClient();
  const documents = await listPortalDocuments(supabase, client.client.id);

  return (
    <div className="space-y-6">
      <PortalPageHeader title="Documents" description="Everything you've uploaded to your tax office." />

      {documents.length === 0 ? (
        <PortalEmptyState
          icon={FolderOpen}
          title="No documents uploaded yet"
          description="Files you upload for document requests will show up here."
        />
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const review = doc.latestReview ? REVIEW_LABELS[doc.latestReview.status] : null;
            return (
              <Card key={doc.id}>
                <CardBody className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{doc.display_name}</p>
                    <p className="text-xs text-muted">
                      {doc.category?.name ?? "Uncategorized"} · Uploaded {formatDate(doc.uploaded_at)}
                    </p>
                  </div>
                  {review && <StatusBadge label={review.label} tone={review.tone} />}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
