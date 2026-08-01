"use client";

import { useState, useTransition } from "react";
import { FileCheck, FileX, Clock3 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DocumentUploadButton } from "@/components/portal/documents/DocumentUploadButton";
import { markDocumentRuleStatusAction } from "@/lib/actions/organizer";
import { formatDate } from "@/lib/utils";
import type { DocumentRow, IntakeDocumentRule } from "@/lib/types";

type RuleStatus = "not_applicable" | "unavailable" | "will_provide_later";

export function OrganizerDocumentsStep({
  submissionId,
  workspaceId,
  clientId,
  engagementId,
  rules,
  documents,
  metadata,
  disabled,
}: {
  submissionId: string;
  workspaceId: string;
  clientId: string;
  engagementId: string | null;
  rules: IntakeDocumentRule[];
  documents: DocumentRow[];
  metadata: Record<string, unknown>;
  disabled: boolean;
}) {
  const ruleStatus = (metadata.document_rule_status as Record<string, RuleStatus>) ?? {};

  if (rules.length === 0 && documents.length === 0) {
    return <p className="text-sm text-muted">No specific documents are required yet. You can still upload anything relevant below.</p>;
  }

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <DocumentRuleCard
          key={rule.id}
          rule={rule}
          submissionId={submissionId}
          workspaceId={workspaceId}
          clientId={clientId}
          engagementId={engagementId}
          status={ruleStatus[rule.id]}
          disabled={disabled}
        />
      ))}

      {documents.length > 0 && (
        <Card>
          <CardBody>
            <p className="mb-2 text-sm font-semibold text-foreground">Uploaded documents</p>
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-foreground">{doc.display_name}</span>
                  <span className="shrink-0 text-xs text-muted">{formatDate(doc.uploaded_at)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function DocumentRuleCard({
  rule,
  submissionId,
  workspaceId,
  clientId,
  engagementId,
  status,
  disabled,
}: {
  rule: IntakeDocumentRule;
  submissionId: string;
  workspaceId: string;
  clientId: string;
  engagementId: string | null;
  status?: RuleStatus;
  disabled: boolean;
}) {
  const [localStatus, setLocalStatus] = useState(status);
  const [isPending, startTransition] = useTransition();

  const mark = (next: RuleStatus) => {
    startTransition(async () => {
      const result = await markDocumentRuleStatusAction(submissionId, rule.id, next);
      if (!result?.error) setLocalStatus(next);
    });
  };

  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{rule.document_label}</p>
            {rule.description && <p className="text-xs text-muted">{rule.description}</p>}
          </div>
          {rule.is_required && <StatusBadge label="Required" tone="warning" />}
        </div>

        {localStatus && (
          <StatusBadge
            label={
              localStatus === "not_applicable"
                ? "Not applicable"
                : localStatus === "unavailable"
                  ? "I don't have this"
                  : "Will provide later"
            }
            tone="neutral"
          />
        )}

        {!disabled && (
          <div className="flex flex-wrap items-center gap-2">
            <DocumentUploadButton
              workspaceId={workspaceId}
              clientId={clientId}
              engagementId={engagementId ?? undefined}
              organizerSubmissionId={submissionId}
              displayName={rule.document_label}
              label="Upload"
            />
            <button
              type="button"
              disabled={isPending}
              onClick={() => mark("not_applicable")}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted hover:bg-slate-100"
            >
              <FileX className="size-3.5" /> Not applicable
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => mark("unavailable")}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted hover:bg-slate-100"
            >
              <FileCheck className="size-3.5" /> I don&apos;t have this
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => mark("will_provide_later")}
              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-muted hover:bg-slate-100"
            >
              <Clock3 className="size-3.5" /> I&apos;ll provide later
            </button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
