"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/LegacyButton";
import { FormField, inputClassName } from "@/components/ui/FormField";
import { toast } from "@/lib/toast";
import { createOrganizerTemplateAction } from "@/lib/actions/organizer";

export function CreateOrganizerTemplateDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New template
      </Button>
    );
  }

  const create = () => {
    startTransition(async () => {
      const result = await createOrganizerTemplateAction({ name, category: category || undefined });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Template created.");
      setOpen(false);
      setName("");
      setCategory("");
      if (result?.templateId) router.push(`/settings/organizers/${result.templateId}`);
      router.refresh();
    });
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Template name" htmlFor="newTemplateName">
          <input
            id="newTemplateName"
            className={inputClassName}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Individual 1040 Organizer"
          />
        </FormField>
        <FormField label="Category" htmlFor="newTemplateCategory" hint="Optional">
          <input
            id="newTemplateCategory"
            className={inputClassName}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Tax Organizer"
          />
        </FormField>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button size="sm" loading={isPending} disabled={!name.trim()} onClick={create}>
          Create template
        </Button>
      </div>
    </div>
  );
}
