import Link from "next/link";
import { Briefcase, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { getLinkedEroWorkspace } from "@/lib/auth/ero-links";
import { EngagementsTable } from "@/features/engagements/engagements-table";

export default async function EngagementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user!.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  const workspaceId = membership!.workspace_id;

  const [{ data: engagements }, linkedEro] = await Promise.all([
    supabase
      .from("tax_engagements")
      .select("id, engagement_number, title, tax_year, return_type, status, priority, due_date, ero_review_status, client:clients(first_name, last_name, company)")
      .eq("workspace_id", workspaceId)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    getLinkedEroWorkspace(workspaceId),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tax Engagements</h1>
          <p className="text-sm text-muted-foreground mt-1">All tax preparation engagements in your workspace.</p>
        </div>
        <Button asChild variant="brand">
          <Link href="/engagements/new">
            <Plus className="h-4 w-4" /> New engagement
          </Link>
        </Button>
      </div>

      {!engagements || engagements.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="No tax engagements yet"
          description="Create your first engagement to start tracking a return."
          actionLabel="Create engagement"
          actionHref="/engagements/new"
        />
      ) : (
        <EngagementsTable engagements={engagements} workspaceId={workspaceId} linkedEro={linkedEro} />
      )}
    </div>
  );
}
