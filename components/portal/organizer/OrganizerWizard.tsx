"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ListChecks, CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/LegacyButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IntakeProgress } from "@/components/intakes/IntakeProgress";
import { GenericSectionFields } from "@/components/portal/intake/GenericSectionFields";
import { HouseholdManager } from "@/components/portal/intake/HouseholdManager";
import { RepeatableEntityManager } from "@/components/portal/intake/RepeatableEntityManager";
import { ReviewSubmitTab } from "@/components/portal/intake/ReviewSubmitTab";
import { OrganizerDocumentsStep } from "@/components/portal/organizer/OrganizerDocumentsStep";
import { isSectionVisible, isFieldVisible, isIntakeEditable, type PortalIntakeDetail } from "@/lib/data/portal-intakes";
import { REPEATABLE_SECTION_ENTITY_TYPE, HOUSEHOLD_SECTION_KEY } from "@/lib/intake-entity-map";
import { updateCurrentSectionAction } from "@/lib/actions/organizer";
import { friendlyIntakeStatusMeta } from "@/lib/portal-copy";

type Step =
  | { kind: "section"; id: string; label: string }
  | { kind: "documents"; id: "documents"; label: string }
  | { kind: "review"; id: "review"; label: string };

export function OrganizerWizard({
  detail,
  workspaceId,
  clientId,
}: {
  detail: PortalIntakeDetail;
  workspaceId: string;
  clientId: string;
}) {
  const editable = isIntakeEditable(detail.submission);
  const visibleSections = useMemo(
    () => detail.sections.filter((section) => isSectionVisible(detail.visibility, section)),
    [detail.sections, detail.visibility],
  );

  const steps: Step[] = useMemo(
    () => [
      ...visibleSections.map((s) => ({ kind: "section" as const, id: s.id, label: s.title })),
      { kind: "documents" as const, id: "documents" as const, label: "Documents" },
      { kind: "review" as const, id: "review" as const, label: "Review & submit" },
    ],
    [visibleSections],
  );

  const initialIndex = useMemo(() => {
    if (!detail.submission.current_section_id) return 0;
    const idx = steps.findIndex((s) => s.id === detail.submission.current_section_id);
    return idx >= 0 ? idx : 0;
  }, [detail.submission.current_section_id, steps]);

  const [stepIndex, setStepIndex] = useState(initialIndex);
  const [showOverview, setShowOverview] = useState(false);

  const isSectionAnswered = (sectionId: string) => {
    const section = visibleSections.find((s) => s.id === sectionId);
    if (!section) return false;
    const requiredVisible = section.fields.filter((f) => f.is_required && isFieldVisible(detail.visibility, f));
    if (requiredVisible.length === 0) return true;
    return requiredVisible.every((f) => f.answer?.answer_value !== null && f.answer?.answer_value !== undefined);
  };

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, index));
    setStepIndex(clamped);
    setShowOverview(false);
    const step = steps[clamped];
    if (step.kind === "section") {
      void updateCurrentSectionAction(detail.submission.id, step.id);
    }
  };

  const status = friendlyIntakeStatusMeta(detail.submission.status);
  const percent = Math.round(detail.submission.progress_percent);
  const step = steps[stepIndex];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{step.label}</p>
          <p className="text-xs text-muted">
            Step {stepIndex + 1} of {steps.length}
          </p>
        </div>
        <StatusBadge label={status.label} tone={status.tone} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <IntakeProgress percent={percent} />
        <button
          type="button"
          onClick={() => setShowOverview((v) => !v)}
          className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-accent-700 hover:bg-accent-50"
        >
          <ListChecks className="size-4" /> Sections
        </button>
      </div>

      {showOverview ? (
        <div className="space-y-1 rounded-2xl border border-border bg-surface p-2">
          {steps.map((s, idx) => {
            const answered = s.kind === "section" ? isSectionAnswered(s.id) : idx < stepIndex;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(idx)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-accent-50/60"
              >
                {answered ? (
                  <CheckCircle2 className="size-4 shrink-0 text-accent-600" />
                ) : (
                  <Circle className="size-4 shrink-0 text-slate-300" />
                )}
                <span className={idx === stepIndex ? "font-medium text-foreground" : "text-muted"}>{s.label}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="min-h-[240px]">
          {step.kind === "section" &&
            (() => {
              const section = visibleSections.find((s) => s.id === step.id)!;
              if (section.section_key === HOUSEHOLD_SECTION_KEY) {
                return <HouseholdManager submissionId={detail.submission.id} people={detail.household} disabled={!editable} />;
              }
              const entityType = REPEATABLE_SECTION_ENTITY_TYPE[section.section_key];
              if (entityType) {
                const entities = detail.repeatableEntities.filter((e) => e.entity_type === entityType);
                return (
                  <RepeatableEntityManager
                    submissionId={detail.submission.id}
                    entityType={entityType}
                    sectionTitle={section.title}
                    fields={section.fields}
                    visibility={detail.visibility}
                    entities={entities}
                    disabled={!editable}
                  />
                );
              }
              return (
                <GenericSectionFields
                  submissionId={detail.submission.id}
                  section={section}
                  visibility={detail.visibility}
                  disabled={!editable}
                />
              );
            })()}

          {step.kind === "documents" && (
            <OrganizerDocumentsStep
              submissionId={detail.submission.id}
              workspaceId={workspaceId}
              clientId={clientId}
              engagementId={detail.submission.engagement_id}
              rules={detail.documentRules}
              documents={detail.documents}
              metadata={(detail.submission.metadata as Record<string, unknown>) ?? {}}
              disabled={!editable}
            />
          )}

          {step.kind === "review" && (
            <ReviewSubmitTab
              submission={detail.submission}
              validationResults={detail.validationResults}
              editable={editable}
            />
          )}
        </div>
      )}

      {!showOverview && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 p-3 backdrop-blur sm:sticky sm:bottom-0 sm:rounded-2xl sm:border">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <Button variant="secondary" size="sm" disabled={stepIndex === 0} onClick={() => goTo(stepIndex - 1)}>
              <ChevronLeft className="size-4" /> Back
            </Button>
            {step.kind !== "review" && (
              <Button size="sm" onClick={() => goTo(stepIndex + 1)}>
                Continue <ChevronRight className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
