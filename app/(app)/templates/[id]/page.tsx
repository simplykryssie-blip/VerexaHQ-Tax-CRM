import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { getTemplateDetail } from "@/features/templates/queries";
import { TemplateDetailPanel } from "@/features/templates/template-detail-panel";

export default async function TemplateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { template, versions } = await getTemplateDetail(id);
  if (!template) notFound();

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

  return (
    <div className="space-y-4">
      <Link href="/templates" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to templates
      </Link>
      {template.kind === "workflow" && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/workflows?templateId=${template.id}`}>Open workflow builder →</Link>
        </Button>
      )}
      <TemplateDetailPanel template={template} versions={versions} workspaceId={workspaceId} />
    </div>
  );
}
