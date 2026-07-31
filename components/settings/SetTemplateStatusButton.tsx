"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/LegacyButton";
import { toast } from "@/lib/toast";
import { setOrganizerTemplateStatusAction } from "@/lib/actions/organizer";

export function SetTemplateStatusButton({
  templateId,
  targetStatus,
}: {
  templateId: string;
  targetStatus: "published" | "archived";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const update = () => {
    startTransition(async () => {
      const result = await setOrganizerTemplateStatusAction(templateId, targetStatus);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(targetStatus === "published" ? "Template activated." : "Template deactivated.");
      router.refresh();
    });
  };

  return (
    <Button size="sm" variant="secondary" loading={isPending} onClick={update}>
      {targetStatus === "published" ? (
        <>
          <CheckCircle2 className="size-4" /> Activate
        </>
      ) : (
        <>
          <Archive className="size-4" /> Deactivate
        </>
      )}
    </Button>
  );
}
