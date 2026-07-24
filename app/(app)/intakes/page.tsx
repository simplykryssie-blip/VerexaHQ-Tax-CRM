import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import { listIntakes, getDistinctTaxYears, INTAKES_PAGE_SIZE, type IntakeListItem } from "@/lib/data/intakes";
import { listWorkspaceStaff } from "@/lib/data/users";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pagination } from "@/components/ui/Pagination";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IntakesFilterBar } from "@/components/intakes/IntakesFilterBar";
import { intakeSubmissionStatusMeta } from "@/lib/status";
import { clientDisplayName, formatDate, formatRelativeTime } from "@/lib/utils";
import type { IntakeSubmissionStatus } from "@/lib/types";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";

const VALID_STATUSES: IntakeSubmissionStatus[] = [
  "not_started",
  "in_progress",
  "submitted",
  "changes_requested",
  "resubmitted",
  "under_review",
  "approved",
  "rejected",
  "archived",
];

export default async function IntakesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const params = await searchParams;
  const page = Number(params.page) > 0 ? Number(params.page) : 1;
  const status = VALID_STATUSES.includes(params.status as IntakeSubmissionStatus)
    ? (params.status as IntakeSubmissionStatus)
    : undefined;
  const completion = params.completion === "complete" || params.completion === "incomplete" ? params.completion : undefined;
  const taxYear = params.taxYear ? Number(params.taxYear) : undefined;

  const supabase = await createClient();
  const [{ intakes, total }, years, reviewers] = await Promise.all([
    listIntakes(supabase, workspace.workspace.id, {
      page,
      status,
      taxYear,
      reviewer: params.reviewer || undefined,
      missingDocuments: params.missingDocuments === "1",
      clarificationNeeded: params.clarificationNeeded === "1",
      validationFailures: params.validationFailures === "1",
      completion,
    }),
    getDistinctTaxYears(supabase, workspace.workspace.id),
    listWorkspaceStaff(supabase, workspace.workspace.id),
  ]);

  const columns: DataTableColumn<IntakeListItem>[] = [
    {
      key: "client",
      header: "Client",
      render: (intake) => (intake.client ? clientDisplayName(intake.client) : "Unknown client"),
    },
    { key: "taxYear", header: "Tax year", render: (intake) => intake.tax_year ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (intake) => {
        const meta = intakeSubmissionStatusMeta(intake.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    { key: "progress", header: "Progress", render: (intake) => `${intake.progress_percent}%` },
    { key: "submitted", header: "Submitted", render: (intake) => formatDate(intake.submitted_at) },
    { key: "reviewer", header: "Reviewer", render: (intake) => intake.reviewerName ?? "Unassigned" },
    {
      key: "validation",
      header: "Validation",
      render: (intake) =>
        intake.unresolvedValidationFailures > 0 ? (
          <StatusBadge label={`${intake.unresolvedValidationFailures} open`} tone="danger" />
        ) : (
          <StatusBadge label="Clean" tone="success" />
        ),
    },
    {
      key: "clarifications",
      header: "Clarifications",
      render: (intake) =>
        intake.outstandingClarifications > 0 ? (
          <StatusBadge label={String(intake.outstandingClarifications)} tone="warning" />
        ) : (
          <span className="text-muted">0</span>
        ),
    },
    {
      key: "documents",
      header: "Documents",
      render: (intake) =>
        intake.outstandingDocuments > 0 ? (
          <StatusBadge label={`${intake.outstandingDocuments} missing`} tone="warning" />
        ) : (
          <StatusBadge label="Complete" tone="success" />
        ),
    },
    { key: "updated", header: "Last updated", render: (intake) => formatRelativeTime(intake.updated_at) },
    {
      key: "action",
      header: "",
      className: "text-right",
      render: (intake) => (
        <Link
          href={`/intakes/${intake.id}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-accent-700 hover:underline"
        >
          Open <ArrowRight className="size-3.5" />
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Intake queue" description="Track every tax intake from start to approval." />

      <IntakesFilterBar
        years={years}
        reviewers={reviewers}
        current={{
          taxYear: params.taxYear ?? "",
          status: params.status ?? "",
          reviewer: params.reviewer ?? "",
          missingDocuments: params.missingDocuments ?? "",
          clarificationNeeded: params.clarificationNeeded ?? "",
          validationFailures: params.validationFailures ?? "",
          completion: params.completion ?? "",
        }}
      />

      <Card>
        {intakes.length === 0 ? (
          <div className="p-6">
            <EmptyState icon={FileText} title="No intakes found" description="Try adjusting your filters." />
          </div>
        ) : (
          <>
            <DataTable columns={columns} rows={intakes} rowKey={(i) => i.id} />
            <Pagination
              page={page}
              pageSize={INTAKES_PAGE_SIZE}
              total={total}
              buildHref={(p) => {
                const sp = new URLSearchParams();
                for (const [key, value] of Object.entries(params)) {
                  if (value && key !== "page") sp.set(key, value);
                }
                sp.set("page", String(p));
                return `/intakes?${sp.toString()}`;
              }}
            />
          </>
        )}
      </Card>
    </div>
  );
}
