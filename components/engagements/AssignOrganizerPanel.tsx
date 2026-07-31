"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/LegacyButton";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { toast } from "@/lib/toast";
import { assignOrganizerAction, rolloverOrganizerAction } from "@/lib/actions/organizer";

type TemplateOption = { id: string; name: string };
type PriorSubmission = { id: string; taxYear: number | null };

export function AssignOrganizerPanel({
  engagementId,
  templates,
  recommendedTemplateId,
  priorYearSubmissions,
}: {
  engagementId: string;
  templates: TemplateOption[];
  recommendedTemplateId: string | null;
  priorYearSubmissions: PriorSubmission[];
}) {
  const router = useRouter();
  const [templateId, setTemplateId] = useState(recommendedTemplateId ?? templates[0]?.id ?? "");
  const [dueDate, setDueDate] = useState("");
  const [sourceSubmissionId, setSourceSubmissionId] = useState(priorYearSubmissions[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  const assign = () => {
    startTransition(async () => {
      const result = await assignOrganizerAction({ engagementId, templateId: templateId || undefined, dueDate });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Organizer assigned.");
      router.refresh();
    });
  };

  const rollover = () => {
    if (!sourceSubmissionId) return;
    startTransition(async () => {
      const result = await rolloverOrganizerAction({ sourceSubmissionId, engagementId });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Organizer created from prior year.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Template" htmlFor="organizerTemplate">
          <select
            id="organizerTemplate"
            className={inputClassName}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Due date" htmlFor="organizerDueDate" hint="Defaults to the engagement's due date.">
          <input
            id="organizerDueDate"
            type="date"
            className={inputClassName}
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </FormField>
      </div>
      <Button size="sm" loading={isPending} onClick={assign} disabled={!templateId}>
        Assign Organizer
      </Button>

      {priorYearSubmissions.length > 0 && (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground">Or copy from a prior year</p>
          <div className="flex flex-wrap items-end gap-3">
            <FormField label="Prior-year organizer" htmlFor="priorYear">
              <select
                id="priorYear"
                className={inputClassName}
                value={sourceSubmissionId}
                onChange={(e) => setSourceSubmissionId(e.target.value)}
              >
                {priorYearSubmissions.map((s) => (
                  <option key={s.id} value={s.id}>
                    Tax year {s.taxYear ?? "—"}
                  </option>
                ))}
              </select>
            </FormField>
            <Button size="sm" variant="secondary" loading={isPending} onClick={rollover}>
              Copy Prior Year
            </Button>
          </div>
          <p className="text-xs text-muted">
            Household, business, and identity details will be carried forward — your client will be asked to review
            and confirm them. Income and expense amounts are never copied.
          </p>
        </div>
      )}
    </div>
  );
}
