import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getIntakeDetail } from "@/lib/data/intakes";
import { listDocumentRequestsForClient } from "@/lib/data/document-requests";
import { REVIEW_ROLES, STAFF_ROLES, type MembershipRole } from "@/lib/types";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Tabs, type TabDefinition } from "@/components/ui/Tabs";
import { IntakeDetailHeader } from "@/components/intakes/IntakeDetailHeader";
import { IntakeAnswersTab } from "@/components/intakes/IntakeAnswersTab";
import { IntakeValidationTab } from "@/components/intakes/IntakeValidationTab";
import { IntakeDocumentsTab } from "@/components/intakes/IntakeDocumentsTab";
import { IntakeRevisionsTab } from "@/components/intakes/IntakeRevisionsTab";
import { ClientHouseholdTab } from "@/components/clients/ClientHouseholdTab";
import { ClientIncomeTab } from "@/components/clients/ClientIncomeTab";
import { ClientDeductionsTab } from "@/components/clients/ClientDeductionsTab";
import { ReviewSectionCard } from "@/components/intakes/ReviewSectionCard";
import { ClarificationPanel } from "@/components/intakes/ClarificationPanel";
import { ReviewActivityList } from "@/components/intakes/ReviewActivityList";
import { IntakeActionsBar } from "@/components/intakes/IntakeActionsBar";

/**
 * The one consolidated organizer/intake review workspace (Part 10/16) —
 * shared by both /intakes/[submissionId] and /engagements/[engagementId]/
 * organizer so there is exactly one implementation of "review answers,
 * documents, clarifications, and activity together," not two competing
 * copies of the same screen.
 */
export async function IntakeReviewWorkspace({
  workspaceId,
  role,
  submissionId,
}: {
  workspaceId: string;
  role: MembershipRole;
  submissionId: string;
}) {
  const supabase = await createClient();
  const detail = await getIntakeDetail(supabase, workspaceId, submissionId);
  if (!detail) notFound();

  const canReview = REVIEW_ROLES.includes(role);
  const canStaff = STAFF_ROLES.includes(role);

  const correlatedRequests = detail.client
    ? (await listDocumentRequestsForClient(supabase, workspaceId, detail.client.id)).filter(
        (request) => request.template_version_id === detail.submission.template_version_id,
      )
    : [];

  const fieldOptions = Array.from(
    new Map(
      detail.answers
        .filter((a) => a.field)
        .map((a) => [a.field!.id, { id: a.field!.id, label: a.field!.label || a.field_key }]),
    ).values(),
  );

  const tabs: TabDefinition[] = [
    { id: "answers", label: "Answers", content: <IntakeAnswersTab answers={detail.answers} /> },
    { id: "household", label: "Household", content: <ClientHouseholdTab people={detail.household} /> },
    { id: "income", label: "Income", content: <ClientIncomeTab sources={detail.income} /> },
    { id: "deductions", label: "Deductions & credits", content: <ClientDeductionsTab items={detail.deductions} /> },
    { id: "validation", label: "Validation", content: <IntakeValidationTab results={detail.validationResults} /> },
    {
      id: "documents",
      label: "Documents",
      content: <IntakeDocumentsTab rules={detail.documentRules} requests={correlatedRequests} />,
    },
    {
      id: "revisions",
      label: "Revision history",
      content: <IntakeRevisionsTab revisions={detail.revisions} userMap={detail.userMap} />,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <IntakeDetailHeader submission={detail.submission} client={detail.client} />
        <Tabs tabs={tabs} />
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Review sections</h2>
          </CardHeader>
          <CardBody className="space-y-2">
            {detail.reviewSections.length === 0 ? (
              <p className="text-sm text-muted">No review sections yet. Begin review to generate them.</p>
            ) : (
              detail.reviewSections.map((section) => (
                <ReviewSectionCard
                  key={section.id}
                  submissionId={submissionId}
                  reviewSection={section}
                  canReview={canReview}
                />
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Clarifications</h2>
          </CardHeader>
          <CardBody>
            <ClarificationPanel
              submissionId={submissionId}
              comments={detail.reviewComments}
              fieldOptions={fieldOptions}
              canRequest={canStaff}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold text-foreground">Activity</h2>
          </CardHeader>
          <CardBody>
            <ReviewActivityList actions={detail.reviewActions} userMap={detail.userMap} />
          </CardBody>
        </Card>

        {(canReview || canStaff) && (
          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold text-foreground">Actions</h2>
            </CardHeader>
            <CardBody>
              <IntakeActionsBar
                submissionId={submissionId}
                status={detail.submission.status}
                canReview={canReview}
                canStaff={canStaff}
              />
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
