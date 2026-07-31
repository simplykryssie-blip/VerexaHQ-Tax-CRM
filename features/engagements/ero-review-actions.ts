import { createClient } from "@/lib/supabase/client";
import type { Enums } from "@/types/database";

/** ERO-side decision on a pending review — approving unblocks the hard
 * "ready to transmit" gate in efile_events; needs_revision requires a
 * comment so the PTIN holder knows what to fix. */
export async function reviewEroSubmission(
  reviewId: string,
  status: Extract<Enums<"ero_review_status">, "approved" | "needs_revision">,
  comment: string | null,
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("ero_reviews")
    .update({
      status,
      comment,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id ?? null,
    })
    .eq("id", reviewId);
  if (error) throw new Error(error.message);
}
