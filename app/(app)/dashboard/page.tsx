import { redirect } from "next/navigation";
import { requireWorkspace } from "@/lib/auth/workspace";
import { defaultPracticeView, PRACTICE_VIEW_HOME } from "@/lib/practice-views";

export default async function DashboardPage() {
  const { workspace } = await requireWorkspace();
  if (!workspace) redirect("/workspaces");
  const view = defaultPracticeView(workspace.workspace.workspace_type, workspace.role);
  redirect(PRACTICE_VIEW_HOME[view]);
}
