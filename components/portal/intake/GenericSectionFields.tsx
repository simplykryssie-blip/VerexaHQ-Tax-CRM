import { DynamicField } from "@/components/portal/intake/DynamicField";
import { isFieldVisible } from "@/lib/data/portal-intakes";
import type { PortalIntakeSection } from "@/lib/data/portal-intakes";

export function GenericSectionFields({
  submissionId,
  section,
  visibility,
  disabled,
}: {
  submissionId: string;
  section: PortalIntakeSection;
  visibility: Map<string, boolean>;
  disabled: boolean;
}) {
  const visibleFields = section.fields.filter((field) => isFieldVisible(visibility, field));

  if (visibleFields.length === 0) {
    return <p className="text-sm text-muted">No questions in this section apply to you.</p>;
  }

  return (
    <div className="space-y-5">
      {visibleFields.map((field) => (
        <DynamicField key={field.id} submissionId={submissionId} field={field} disabled={disabled} />
      ))}
    </div>
  );
}
