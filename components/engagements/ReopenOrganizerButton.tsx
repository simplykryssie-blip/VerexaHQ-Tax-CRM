"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/LegacyButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/lib/toast";
import { reopenIntakeAction } from "@/lib/actions/intakes";

export function ReopenOrganizerButton({ submissionId }: { submissionId: string }) {
  const router = useRouter();

  return (
    <ConfirmDialog
      title="Reopen organizer"
      description="This unlocks the organizer for further changes by the client and staff. A reason is required and will be recorded in the submission history."
      confirmLabel="Reopen organizer"
      destructive
      requireReason
      reasonLabel="Reason for reopening"
      onConfirm={(reason) =>
        reopenIntakeAction({ submissionId, reason: reason ?? "" }).then((res) => {
          if (!res?.error) {
            toast.success("Organizer reopened.");
            router.refresh();
          }
          return res;
        })
      }
      trigger={
        <Button size="sm" variant="secondary">
          <RotateCcw className="size-4" /> Reopen Organizer
        </Button>
      }
    />
  );
}
