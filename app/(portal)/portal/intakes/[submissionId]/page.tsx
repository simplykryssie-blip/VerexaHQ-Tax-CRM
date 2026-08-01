import { notFound } from "next/navigation";
import { requirePortalAccess } from "@/lib/auth/portal";
import { createClient } from "@/lib/supabase/server";
import { getPortalIntakeDetail, isIntakeEditable, isSectionVisible } from "@/lib/data/portal-intakes";
import { REPEATABLE_SECTION_ENTITY_TYPE, HOUSEHOLD_SECTION_KEY } from "@/lib/intake-entity-map";
import { PortalPageHeader } from "@/components/portal/PortalPageHeader";
import { Tabs, type TabDefinition } from "@/components/ui/TabSwitcher";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IntakeProgress } from "@/components/intakes/IntakeProgress";
import { GenericSectionFields } from "@/components/portal/intake/GenericSectionFields";
import { HouseholdManager } from "@/components/portal/intake/HouseholdManager";
import { RepeatableEntityManager } from "@/components/portal/intake/RepeatableEntityManager";
import { ReviewSubmitTab } from "@/components/portal/intake/ReviewSubmitTab";
import { friendlyIntakeStatusMeta } from "@/lib/portal-copy";
import { PortalNotLinkedState } from "@/components/ui/PortalNotLinkedState";
import type { PortalIntakeSection } from "@/lib/data/portal-intakes";

export default async function PortalIntakeDetailPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const { client } = await requirePortalAccess();
  if (!client) return <PortalNotLinkedState />;

  const { submissionId } = await params;
  const supabase = await createClient();
  const detail = await getPortalIntakeDetail(supabase, client.client.id, submissionId);
  if (!detail) notFound();

  const editable = isIntakeEditable(detail.submission);
  const status = friendlyIntakeStatusMeta(detail.submission.status);

  const visibleSections = detail.sections.filter((section) => isSectionVisible(detail.visibility, section));

  // Group sections by tens-digit of sort_order (e.g. income=60, employment_w2=61,
  // retirement_benefits=62 all land in the same "60" group/tab) — the template
  // doesn't use parent_section_id, so this is a schema-driven grouping
  // heuristic rather than a hard-coded list of section keys.
  const groups = new Map<number, PortalIntakeSection[]>();
  for (const section of visibleSections) {
    const groupKey = Math.floor(section.sort_order / 10) * 10;
    const list = groups.get(groupKey) ?? [];
    list.push(section);
    groups.set(groupKey, list);
  }

  const tabs: TabDefinition[] = [];

  for (const [groupKey, sections] of Array.from(groups.entries()).sort((a, b) => a[0] - b[0])) {
    const primary = sections[0];
    tabs.push({
      id: `group-${groupKey}`,
      label: primary.title,
      content: (
        <div className="space-y-6">
          {sections.map((section) => {
            if (section.section_key === HOUSEHOLD_SECTION_KEY) {
              return (
                <div key={section.id}>
                  {sections.length > 1 && <h3 className="mb-3 text-sm font-semibold text-foreground">{section.title}</h3>}
                  <HouseholdManager submissionId={submissionId} people={detail.household} disabled={!editable} />
                </div>
              );
            }

            const entityType = REPEATABLE_SECTION_ENTITY_TYPE[section.section_key];
            if (entityType) {
              const entities = detail.repeatableEntities.filter((e) => e.entity_type === entityType);
              return (
                <div key={section.id}>
                  {sections.length > 1 && <h3 className="mb-3 text-sm font-semibold text-foreground">{section.title}</h3>}
                  <RepeatableEntityManager
                    submissionId={submissionId}
                    entityType={entityType}
                    sectionTitle={section.title}
                    fields={section.fields}
                    visibility={detail.visibility}
                    entities={entities}
                    disabled={!editable}
                  />
                </div>
              );
            }

            return (
              <div key={section.id}>
                {sections.length > 1 && <h3 className="mb-3 text-sm font-semibold text-foreground">{section.title}</h3>}
                <GenericSectionFields
                  submissionId={submissionId}
                  section={section}
                  visibility={detail.visibility}
                  disabled={!editable}
                />
              </div>
            );
          })}
        </div>
      ),
    });
  }

  tabs.push({
    id: "review",
    label: "Review & Submit",
    content: (
      <ReviewSubmitTab
        submission={detail.submission}
        validationResults={detail.validationResults}
        editable={editable}
      />
    ),
  });

  return (
    <div className="space-y-6">
      <PortalPageHeader
        title={`Tax year ${detail.submission.tax_year ?? "—"}`}
        actions={<StatusBadge label={status.label} tone={status.tone} />}
      />
      <IntakeProgress percent={detail.submission.progress_percent} />
      <Tabs tabs={tabs} />
    </div>
  );
}
