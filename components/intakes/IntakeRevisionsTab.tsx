import { History } from "lucide-react";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTime, titleCase } from "@/lib/utils";
import type { IntakeSubmissionRevision } from "@/lib/types";
import type { UserSummary } from "@/lib/data/users";

export function IntakeRevisionsTab({
  revisions,
  userMap,
}: {
  revisions: IntakeSubmissionRevision[];
  userMap: Map<string, UserSummary>;
}) {
  if (revisions.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState icon={History} title="No submission history yet" />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody className="divide-y divide-border p-0">
        {revisions.map((revision) => (
          <div key={revision.id} className="px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">
                Revision #{revision.revision_number} · {titleCase(revision.reason)}
              </p>
              <span className="text-xs text-muted">{formatDateTime(revision.created_at)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {revision.created_by ? userMap.get(revision.created_by)?.name ?? "Staff member" : "System"}
              {revision.reason_details ? ` · ${revision.reason_details}` : ""}
            </p>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
