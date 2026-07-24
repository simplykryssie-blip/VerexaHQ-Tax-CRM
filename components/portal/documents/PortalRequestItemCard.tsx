import { StatusBadge } from "@/components/ui/StatusBadge";
import { DocumentUploadButton } from "@/components/portal/documents/DocumentUploadButton";
import { friendlyDocumentItemStatusMeta } from "@/lib/portal-copy";
import type { PortalRequestItem } from "@/lib/data/portal-document-requests";

export function PortalRequestItemCard({
  item,
  workspaceId,
  clientId,
  canUpload,
}: {
  item: PortalRequestItem;
  workspaceId: string;
  clientId: string;
  canUpload: boolean;
}) {
  const status = friendlyDocumentItemStatusMeta(item.status);
  const canReplace = canUpload && ["requested", "rejected"].includes(item.status);

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">
            {item.custom_label || item.document_label}
            {item.category && <span className="ml-2 text-xs font-normal text-muted">{item.category.name}</span>}
          </p>
          {item.description && <p className="mt-1 text-sm text-muted">{item.description}</p>}
          <p className="mt-1 text-xs text-muted">{item.is_required ? "Required" : "Optional"}</p>
        </div>
        <StatusBadge label={status.label} tone={status.tone} />
      </div>

      {canReplace && (
        <div className="mt-3">
          <DocumentUploadButton
            workspaceId={workspaceId}
            clientId={clientId}
            requestItemId={item.id}
            categoryId={item.category_id ?? undefined}
            label={item.status === "rejected" ? "Upload replacement" : "Upload"}
          />
        </div>
      )}
    </div>
  );
}
