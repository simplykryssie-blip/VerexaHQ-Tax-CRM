import { redirect } from "next/navigation";
import { ClipboardCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { getActiveWorkspace } from "@/lib/auth/workspace";
import { roleHasCapability } from "@/lib/permissions/capabilities";
import { EroReviewInbox, type EroInboxRow } from "@/features/engagements/ero-review-inbox";

const ERO_UPDATE_ROLES = ["owner", "admin", "ero"] as const;

export default async function EroReviewPage() {
  const active = await getActiveWorkspace();
  if (!active) redirect("/workspaces");
  if (!roleHasCapability(active.role, "review_returns")) redirect("/unauthorized");

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("ero_reviews")
    .select(
      "id, status, comment, submitted_at, reviewed_at, ptin_workspace:workspaces!ero_reviews_ptin_workspace_id_fkey(name), engagement:tax_engagements(id, engagement_number, title, tax_year, return_type, client:clients(first_name, last_name, company))",
    )
    .eq("ero_workspace_id", active.workspace.id)
    .order("submitted_at", { ascending: false });

  const canDecide = (ERO_UPDATE_ROLES as readonly string[]).includes(active.role);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">ERO Review</h1>
        <p className="text-sm text-muted-foreground mt-1">Engagements submitted by linked PTIN holders and service bureaus for your review and approval.</p>
      </div>

      {!rows || rows.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No submissions yet" description="Engagements sent to you for review will show up here." />
      ) : (
        <EroReviewInbox rows={rows as unknown as EroInboxRow[]} canDecide={canDecide} />
      )}
    </div>
  );
}
