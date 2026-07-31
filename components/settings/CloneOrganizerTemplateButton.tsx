"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/LegacyButton";
import { toast } from "@/lib/toast";
import { cloneOrganizerTemplateAction } from "@/lib/actions/organizer";

export function CloneOrganizerTemplateButton({ templateId }: { templateId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const clone = () => {
    startTransition(async () => {
      const result = await cloneOrganizerTemplateAction(templateId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Template cloned to your workspace.");
      if (result?.templateId) router.push(`/settings/organizers/${result.templateId}`);
      router.refresh();
    });
  };

  return (
    <Button size="sm" variant="secondary" loading={isPending} onClick={clone}>
      <Copy className="size-4" /> Clone
    </Button>
  );
}
