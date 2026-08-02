"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import { toast } from "@/components/ui/toaster";
import { FieldInput } from "@/features/intake/field-input";
import type { FormSectionRow, FormFieldRow } from "@/lib/intake/engine";

const NON_INPUT_TYPES = new Set(["heading", "divider", "paragraph"]);

/** Renders an organizer's actual questions from form_sections/form_fields —
 * the template_versions.content JSON blob is empty for form-kind templates,
 * so this is the only place the real structure is visible. In `editable`
 * mode (a workspace-owned, non-system template) staff can add, edit,
 * remove, and reorder questions while preserving locked system templates. */
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
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState<FormFieldRow["component_type"]>("text");
  const [newFieldSectionId, setNewFieldSectionId] = useState("");

  useEffect(() => {
    let cancelled = false;
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

  async function addField() {
    if (!newFieldSectionId || !newFieldLabel.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const current = fieldsBySection.get(newFieldSectionId) ?? [];
    const fieldKey = `${newFieldLabel.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "question"}_${Date.now().toString(36)}`;
    const { data, error } = await supabase.from("form_fields").insert({
      template_version_id: templateVersionId,
      section_id: newFieldSectionId,
      field_key: fieldKey,
      component_type: newFieldType,
      label: newFieldLabel.trim(),
      sort_order: Math.max(...current.map((field) => field.sort_order), 0) + 10,
      is_required: false,
    }).select("*").single();
    setSaving(false);
    if (error || !data) {
      toast.error(friendlyDbError(error?.message));
      return;
    }
    setFieldsBySection((previous) => {
      const next = new Map(previous);
      next.set(newFieldSectionId, [...(next.get(newFieldSectionId) ?? []), data]);
      return next;
    });
    setNewFieldLabel("");
    toast.success("Question added");
  }

  async function removeField(sectionId: string, field: FormFieldRow) {
    if (!window.confirm(`Remove “${field.label}” from this draft?`)) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("form_fields").delete().eq("id", field.id);
    setSaving(false);
    if (error) {
      toast.error(friendlyDbError(error.message));
      return;
    }
    setFieldsBySection((previous) => {
      const next = new Map(previous);
      next.set(sectionId, (next.get(sectionId) ?? []).filter((item) => item.id !== field.id));
      return next;
    });
    toast.success("Question removed");
  }

  async function moveField(sectionId: string, fieldIndex: number, direction: -1 | 1) {
    const current = [...(fieldsBySection.get(sectionId) ?? [])];
    const swapIndex = fieldIndex + direction;
    if (!current[fieldIndex] || !current[swapIndex]) return;
    const first = current[fieldIndex];
    const second = current[swapIndex];
    setSaving(true);
    const supabase = createClient();
    const [a, b] = await Promise.all([
      supabase.from("form_fields").update({ sort_order: second.sort_order }).eq("id", first.id),
      supabase.from("form_fields").update({ sort_order: first.sort_order }).eq("id", second.id),
    ]);
    setSaving(false);
    if (a.error || b.error) {
      toast.error(friendlyDbError(a.error?.message ?? b.error?.message));
      return;
    }
    current[fieldIndex] = { ...second, sort_order: first.sort_order };
    current[swapIndex] = { ...first, sort_order: second.sort_order };
    setFieldsBySection((previous) => new Map(previous).set(sectionId, current));
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
              {(fieldsBySection.get(section.id) ?? []).map((field, fieldIndex, sectionFields) => {
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
                        <div className="flex items-center gap-1">
                          <label className="mr-2 flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap">
                            <Checkbox checked={v.is_required} onCheckedChange={(c) => updateField(field, { is_required: c === true })} />
                            Required
                          </label>
                          <Button type="button" size="icon" variant="ghost" disabled={saving || fieldIndex === 0} onClick={() => moveField(section.id, fieldIndex, -1)} aria-label="Move question up"><ArrowUp className="size-3.5" /></Button>
                          <Button type="button" size="icon" variant="ghost" disabled={saving || fieldIndex === sectionFields.length - 1} onClick={() => moveField(section.id, fieldIndex, 1)} aria-label="Move question down"><ArrowDown className="size-3.5" /></Button>
                          <Button type="button" size="icon" variant="ghost" disabled={saving || field.is_locked} onClick={() => removeField(section.id, field)} aria-label="Remove question"><Trash2 className="size-3.5 text-destructive" /></Button>
                        </div>
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
        <div className="sticky bottom-0 space-y-3 border-t border-border bg-background pt-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_180px_180px_auto]">
            <Input value={newFieldLabel} onChange={(event) => setNewFieldLabel(event.target.value)} placeholder="New question label" />
            <Select value={newFieldSectionId} onValueChange={setNewFieldSectionId}><SelectTrigger><SelectValue placeholder="Choose section" /></SelectTrigger><SelectContent>{sections.filter((section) => !section.parent_section_id).map((section) => <SelectItem key={section.id} value={section.id}>{section.title}</SelectItem>)}</SelectContent></Select>
            <Select value={newFieldType} onValueChange={(value) => setNewFieldType(value as FormFieldRow["component_type"])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["text","textarea","number","currency","date","email","phone","yes_no","single_choice","multiple_choice","dropdown","file_upload","percentage","acknowledgment","year"].map((type) => <SelectItem key={type} value={type}>{type.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select>
            <Button type="button" variant="outline" disabled={saving || !newFieldLabel.trim() || !newFieldSectionId} onClick={addField}><Plus className="size-4" /> Add</Button>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">{edits.size > 0 ? `${edits.size} question(s) changed` : "Add, edit, reorder, or remove questions in this draft."}</p>
            <Button size="sm" variant="brand" disabled={edits.size === 0 || saving} onClick={saveChanges}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
