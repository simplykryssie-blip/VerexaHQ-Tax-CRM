"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import { toast } from "@/components/ui/toaster";
import { FieldInput } from "@/features/intake/field-input";
import type { FormSectionRow, FormFieldRow } from "@/lib/intake/engine";

const NON_INPUT_TYPES = new Set(["heading", "divider", "paragraph"]);

/** Renders an organizer's actual questions from form_sections/form_fields —
 * the template_versions.content JSON blob is empty for form-kind templates,
 * so this is the only place the real structure is visible. In `editable`
 * mode (a workspace-owned, non-system template) staff can adjust label,
 * help text, and whether a question is required — adding/removing/
 * reordering sections and fields is a larger form-builder feature, not
 * covered here. */
export function OrganizerStructureViewer({
  templateVersionId,
  editable = false,
}: {
  templateVersionId: string;
  editable?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<FormSectionRow[]>([]);
  const [fieldsBySection, setFieldsBySection] = useState<Map<string | null, FormFieldRow[]>>(new Map());
  const [edits, setEdits] = useState<Map<string, { label: string; help_text: string; is_required: boolean }>>(new Map());

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    Promise.all([
      supabase.from("form_sections").select("*").eq("template_version_id", templateVersionId).order("sort_order"),
      supabase.from("form_fields").select("*").eq("template_version_id", templateVersionId).order("sort_order"),
    ]).then(([sectionsRes, fieldsRes]) => {
      if (cancelled) return;
      const secs = sectionsRes.data ?? [];
      const fields = fieldsRes.data ?? [];
      const grouped = new Map<string | null, FormFieldRow[]>();
      for (const f of fields) grouped.set(f.section_id, [...(grouped.get(f.section_id) ?? []), f]);
      setSections(secs);
      setFieldsBySection(grouped);
      setEdits(new Map());
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [templateVersionId]);

  function fieldValue(field: FormFieldRow) {
    return edits.get(field.id) ?? { label: field.label ?? "", help_text: field.help_text ?? "", is_required: field.is_required };
  }

  function updateField(field: FormFieldRow, patch: Partial<{ label: string; help_text: string; is_required: boolean }>) {
    setEdits((prev) => {
      const next = new Map(prev);
      next.set(field.id, { ...fieldValue(field), ...patch });
      return next;
    });
  }

  async function saveChanges() {
    if (edits.size === 0) return;
    setSaving(true);
    const supabase = createClient();
    const results = await Promise.all(
      Array.from(edits.entries()).map(([fieldId, v]) =>
        supabase.from("form_fields").update({ label: v.label, help_text: v.help_text || null, is_required: v.is_required }).eq("id", fieldId),
      ),
    );
    setSaving(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast.error(friendlyDbError(failed.error.message));
      return;
    }
    toast.success("Questions updated");
    setEdits(new Map());
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading questions…
      </div>
    );
  }

  if (sections.length === 0) {
    return <p className="text-sm text-muted-foreground">This organizer has no sections defined yet.</p>;
  }

  return (
    <div className="space-y-5">
      {sections
        .filter((s) => !s.parent_section_id)
        .map((section) => (
          <div key={section.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold">{section.title}</h4>
              {section.is_repeatable && (
                <Badge variant="outline" className="text-[10px]">
                  Repeatable
                </Badge>
              )}
            </div>
            {section.description && <p className="text-xs text-muted-foreground -mt-2">{section.description}</p>}
            <div className="space-y-4 pl-3 border-l border-border">
              {(fieldsBySection.get(section.id) ?? []).map((field) => {
                const isInput = !NON_INPUT_TYPES.has(field.component_type);
                const v = fieldValue(field);
                return (
                  <div key={field.id} className="space-y-1.5">
                    {editable && isInput ? (
                      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-start">
                        <div className="space-y-1.5">
                          <Input
                            value={v.label}
                            onChange={(e) => updateField(field, { label: e.target.value })}
                            className="text-sm font-medium h-8"
                            placeholder="Question label"
                          />
                          <Textarea
                            value={v.help_text}
                            onChange={(e) => updateField(field, { help_text: e.target.value })}
                            placeholder="Help text (optional)"
                            rows={1}
                            className="text-xs"
                          />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1.5 whitespace-nowrap">
                          <Checkbox checked={v.is_required} onCheckedChange={(c) => updateField(field, { is_required: c === true })} />
                          Required
                        </label>
                      </div>
                    ) : (
                      isInput && (
                        <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          {field.label}
                          {field.is_required && <span className="text-destructive">*</span>}
                        </label>
                      )
                    )}
                    <FieldInput field={field} value={null} onChange={() => {}} disabled />
                    {!editable && field.help_text && <p className="text-[11px] text-muted-foreground">{field.help_text}</p>}
                  </div>
                );
              })}
              {(fieldsBySection.get(section.id) ?? []).length === 0 && (
                <p className="text-xs text-muted-foreground italic">No fields in this section.</p>
              )}
            </div>
          </div>
        ))}
      {editable && (
        <div className="sticky bottom-0 bg-background pt-2 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{edits.size > 0 ? `${edits.size} question(s) changed` : "No changes yet"}</p>
          <Button size="sm" variant="brand" disabled={edits.size === 0 || saving} onClick={saveChanges}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save changes
          </Button>
        </div>
      )}
    </div>
  );
}
