"use client";

import { useTransition } from "react";
import { Check, X, MessageCircleQuestion } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { reviewResultMeta } from "@/lib/status";
import { reviewSectionAction } from "@/lib/actions/intakes";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import type { FormSection, IntakeReviewSection, ReviewResult } from "@/lib/types";

export function ReviewSectionCard({
  submissionId,
  reviewSection,
  canReview,
}: {
  submissionId: string;
  reviewSection: IntakeReviewSection & { section: FormSection | null };
  canReview: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const meta = reviewResultMeta(reviewSection.result);

  const setResult = (result: ReviewResult) => {
    startTransition(async () => {
      const res = await reviewSectionAction({
        submissionId,
        sectionId: reviewSection.section_id,
        result,
      });
      if (res?.error) toast.error(res.error);
      else toast.success("Section review updated.");
    });
  };

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-medium text-foreground">
          {reviewSection.section?.title || "Section"}
        </p>
        <StatusBadge label={meta.label} tone={meta.tone} />
      </div>
      {canReview && (
        <div className="mt-2 flex items-center gap-1.5">
          <button
            disabled={isPending}
            onClick={() => setResult("pass")}
            title="Mark passed"
            className={cn(
              "flex size-7 items-center justify-center rounded-md text-accent-600 hover:bg-accent-50 disabled:opacity-50",
            )}
          >
            <Check className="size-4" />
          </button>
          <button
            disabled={isPending}
            onClick={() => setResult("needs_clarification")}
            title="Needs clarification"
            className="flex size-7 items-center justify-center rounded-md text-amber-600 hover:bg-amber-50 disabled:opacity-50"
          >
            <MessageCircleQuestion className="size-4" />
          </button>
          <button
            disabled={isPending}
            onClick={() => setResult("fail")}
            title="Mark failed"
            className="flex size-7 items-center justify-center rounded-md text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
