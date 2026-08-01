"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/LegacyButton";
import { toast } from "@/lib/toast";
import { publishOrganizerTemplateVersionAction } from "@/lib/actions/organizer";

export function PublishTemplateVersionButton({ templateId, versionId }: { templateId: string; versionId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const publish = () => {
    startTransition(async () => {
      const result = await publishOrganizerTemplateVersionAction(templateId, versionId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Version published.");
      router.refresh();
    });
  };

  return (
    <Button size="sm" variant="secondary" loading={isPending} onClick={publish}>
      <UploadCloud className="size-4" /> Publish
    </Button>
  );
}
