import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { documentRequestStatusMeta } from "@/lib/status";
import { formatDate } from "@/lib/utils";
import type { DocumentRow, DocumentRequest } from "@/lib/types";

export function EngagementDocumentsTab({
  documents,
  documentRequest,
}: {
  documents: DocumentRow[];
  documentRequest: DocumentRequest | null;
}) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Primary document request</h2>
        </CardHeader>
        <CardBody>
          {documentRequest ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{documentRequest.title}</p>
                <p className="text-xs text-muted">Due {formatDate(documentRequest.due_date)}</p>
              </div>
              <StatusBadge {...documentRequestStatusMeta(documentRequest.status)} />
            </div>
          ) : (
            <p className="text-sm text-muted">No document request linked to this engagement yet.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-foreground">Documents ({documents.length})</h2>
        </CardHeader>
        <CardBody className="space-y-2">
          {documents.length === 0 ? (
            <p className="text-sm text-muted">No documents uploaded for this engagement yet.</p>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between border-b border-border py-2 last:border-0">
                <div>
                  <p className="text-sm font-medium text-foreground">{doc.display_name}</p>
                  <p className="text-xs text-muted">Uploaded {formatDate(doc.uploaded_at)}</p>
                </div>
                <span className="text-xs text-muted">{doc.status}</span>
              </div>
            ))
          )}
        </CardBody>
      </Card>
    </div>
  );
}
