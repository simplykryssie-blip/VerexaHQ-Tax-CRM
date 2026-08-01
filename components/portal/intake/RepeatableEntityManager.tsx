"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Folder } from "lucide-react";
import { saveRepeatableEntityAction, deleteRepeatableEntityAction } from "@/lib/actions/portal-intake";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/LegacyButton";
import { Card, CardBody } from "@/components/ui/LegacyCard";
import { PortalEmptyState } from "@/components/portal/PortalEmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FieldInput, fieldDefaultValue } from "@/components/portal/intake/FieldInput";
import { isFieldVisible } from "@/lib/data/portal-intakes";
import type { FormField as FormFieldRow, IntakeRepeatableEntity } from "@/lib/types";

export function RepeatableEntityManager({
  submissionId,
  entityType,
  sectionTitle,
  fields,
  visibility,
  entities,
  disabled,
}: {
  submissionId: string;
  entityType: string;
  sectionTitle: string;
  fields: FormFieldRow[];
  visibility: Map<string, boolean>;
  entities: IntakeRepeatableEntity[];
  disabled: boolean;
}) {
  const [editingId, setEditingId] = useState<string | null | "new">(null);
  const visibleFields = fields.filter((f) => isFieldVisible(visibility, f));

  if (editingId !== null) {
    const editing = editingId === "new" ? null : entities.find((e) => e.id === editingId) ?? null;
    return (
      <EntityForm
        submissionId={submissionId}
        entityType={entityType}
        fields={visibleFields}
        entity={editing}
        onDone={() => setEditingId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {entities.length === 0 ? (
        <Card>
          <CardBody>
            <PortalEmptyState icon={Folder} title={`No ${sectionTitle.toLowerCase()} added yet`} />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {entities.map((entity) => (
            <Card key={entity.id}>
              <CardBody className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-foreground">
                  {entity.display_name || sectionTitle}
                </p>
                {!disabled && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingId(entity.id)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                      aria-label="Edit"
                    >
                      <Pencil className="size-4" />
                    </button>
                    <ConfirmDialog
                      title="Remove entry"
                      description={`Remove this ${sectionTitle.toLowerCase()} entry?`}
                      confirmLabel="Remove"
                      destructive
                      onConfirm={async () => {
                        const result = await deleteRepeatableEntityAction({ submissionId, id: entity.id });
                        if (result?.error) toast.error(result.error);
                        return result;
                      }}
                      trigger={
                        <button className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" aria-label="Remove">
                          <Trash2 className="size-4" />
                        </button>
                      }
                    />
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {!disabled && (
        <Button size="sm" variant="secondary" onClick={() => setEditingId("new")}>
          <Plus className="size-4" /> Add {sectionTitle.toLowerCase()}
        </Button>
      )}
    </div>
  );
}

function EntityForm({
  submissionId,
  entityType,
  fields,
  entity,
  onDone,
}: {
  submissionId: string;
  entityType: string;
  fields: FormFieldRow[];
  entity: IntakeRepeatableEntity | null;
  onDone: () => void;
}) {
  const initialData = (entity?.data as Record<string, unknown>) ?? {};
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const next: Record<string, unknown> = {};
    for (const field of fields) {
      next[field.field_key] = initialData[field.field_key] ?? fieldDefaultValue(field.component_type);
    }
    return next;
  });
  const [displayName, setDisplayName] = useState(entity?.display_name ?? "");
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    setIsSaving(true);
    const result = await saveRepeatableEntityAction({
      submissionId,
      entityId: entity?.id,
      entityType,
      displayName: displayName || undefined,
      data: values,
    });
    setIsSaving(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Saved.");
    onDone();
  };

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">Label (optional)</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Main Street Rental"
            className="block w-full rounded-lg border border-border bg-white px-3 py-2 text-sm shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
          />
        </div>

        {fields.map((field) => (
          <FieldInput
            key={field.id}
            field={field}
            value={values[field.field_key]}
            onChange={(next) => setValues((prev) => ({ ...prev, [field.field_key]: next }))}
          />
        ))}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onDone}>
            Cancel
          </Button>
          <Button type="button" size="sm" loading={isSaving} onClick={submit}>
            Save
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
