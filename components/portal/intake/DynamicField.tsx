"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { saveAnswerAction } from "@/lib/actions/portal-intake";
import { toast } from "@/lib/toast";
import { FieldInput, fieldDefaultValue } from "@/components/portal/intake/FieldInput";
import type { FormField as FormFieldRow, IntakeAnswer } from "@/lib/types";

/** One field in a non-repeatable section: renders via FieldInput and autosaves each change into intake_answers. */
export function DynamicField({
  submissionId,
  field,
  disabled,
}: {
  submissionId: string;
  field: FormFieldRow & { answer: IntakeAnswer | null };
  disabled: boolean;
}) {
  const [value, setValue] = useState<unknown>(field.answer?.answer_value ?? fieldDefaultValue(field.component_type));
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const commit = (next: unknown) => {
    setValue(next);
    setSaved(false);
    startTransition(async () => {
      const result = await saveAnswerAction({
        submissionId,
        fieldId: field.id,
        fieldKey: field.field_key,
        value: next,
      });
      if (result?.error) toast.error(result.error);
      else setSaved(true);
    });
  };

  const isStatic = ["heading", "paragraph", "divider"].includes(field.component_type);

  return (
    <div className="relative">
      <FieldInput field={field} value={value} onChange={commit} disabled={disabled} />
      {!isStatic && (
        <div className="absolute right-0 top-0">
          {isPending ? (
            <Loader2 className="size-3.5 animate-spin text-muted" />
          ) : saved ? (
            <Check className="size-3.5 text-accent-600" />
          ) : null}
        </div>
      )}
    </div>
  );
}
