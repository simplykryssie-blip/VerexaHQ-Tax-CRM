import Link from "next/link";
import { ClipboardCheck, FileClock, RotateCcw, Users } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { createClient } from "@/lib/supabase/server";
import {
  DashboardEmpty,
  DashboardSection,
  RoleDashboardHero,
  RoleMetric,
} from "@/components/dashboard/RoleDashboard";
import { Badge } from "@/components/ui/badge";
import { NoWorkspaceState } from "@/components/ui/NoWorkspaceState";
import { formatDateTime } from "@/lib/formatters";
import { eroReviewStatusLabel } from "@/lib/validation/ero-review";

type ReviewRow = {
  id: string;
  status: "pending_review" | "needs_revision" | "approved";
  submitted_at: string;
  ptin_workspace: { name: string } | null;
  engagement: { id: string; title: string; tax_year: number | null } | null;
};

export default async function EroDashboardPage() {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <NoWorkspaceState />;

  const supabase = await createClient();
  const workspaceId = workspace.workspace.id;

  const [clients, members, pending, revisions, intakes, queue] = await Promise.all([
    supabase.from("clients").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("archived_at", null),
    supabase.from("workspace_members").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("status", "active"),
    supabase.from("ero_reviews").select("id", { count: "exact", head: true }).eq("ero_workspace_id", workspaceId).eq("status", "pending_review"),
    supabase.from("ero_reviews").select("id", { count: "exact", head: true }).eq("ero_workspace_id", workspaceId).eq("status", "needs_revision"),
    supabase.from("intake_submissions").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("status", ["submitted", "resubmitted", "under_review"]),
    supabase
      .from("ero_reviews")
      .select("id,status,submitted_at,ptin_workspace:workspaces!ero_reviews_ptin_workspace_id_fkey(name),engagement:tax_engagements(id,title,tax_year)")
      .eq("ero_workspace_id", workspaceId)
      .in("status", ["pending_review", "needs_revision"])
      .order("submitted_at", { ascending: true })
      .limit(8),
  ]);

  const reviews = (queue.data ?? []) as unknown as ReviewRow[];

  return (
    <div className="space-y-6">
      <RoleDashboardHero
        eyebrow="ERO office workspace"
        title={`${workspace.workspace.name} operations`}
        description="Monitor office production, intake pressure, PTIN handoffs, and ERO review decisions before approved work moves to external tax software."
        actions={[
          { href: "/ero-review", label: "Open ERO review" },
          { href: "/work-queue", label: "Office work queue" },
        ]}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RoleMetric icon={Users} label="Active clients" value={clients.count ?? 0} helper="Across this tax office" />
        <RoleMetric icon={Users} label="Team members" value={members.count ?? 0} helper="Active staff and preparers" />
        <RoleMetric icon={ClipboardCheck} label="Pending ERO review" value={pending.count ?? 0} helper="Waiting for an ERO decision" />
        <RoleMetric icon={RotateCcw} label="Needs revision" value={revisions.count ?? 0} helper="Returned to the PTIN holder" />
        <RoleMetric icon={FileClock} label="Intakes needing review" value={intakes.count ?? 0} helper="Submitted or under review" />
      </section>

      <DashboardSection title="ERO review queue" href="/ero-review">
        {reviews.length === 0 ? (
          <DashboardEmpty>No PTIN submissions are waiting for review.</DashboardEmpty>
        ) : (
          <div className="divide-y divide-border">
            {reviews.map((review) => (
              <Link
                key={review.id}
                href={review.engagement ? `/engagements/${review.engagement.id}` : "/ero-review"}
                className="flex items-center justify-between gap-4 py-3.5 hover:bg-muted/40"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{review.engagement?.title ?? "Engagement"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {review.ptin_workspace?.name ?? "PTIN workspace"} · Submitted {formatDateTime(review.submitted_at)}
                  </div>
                </div>
                <Badge variant={review.status === "needs_revision" ? "destructive" : "secondary"}>
                  {eroReviewStatusLabel(review.status)}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
