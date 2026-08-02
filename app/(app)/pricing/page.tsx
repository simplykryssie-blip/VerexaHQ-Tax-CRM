import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { PricingWorkspace, type AssessmentSummary, type PricingPackage, type PricingPerson, type PricingRule, type QuoteSummary } from "@/features/pricing/pricing-workspace";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { createClient } from "@/lib/supabase/server";

export default async function PricingPage() {
  const { workspace } = await requireWorkspace();
  if (!workspace) return <ForbiddenState description="Select a workspace to manage pricing." />;
  const view = await requirePermission(workspace.workspace.id, "pricing.view");
  if (!view.allowed) return <ForbiddenState description={view.reason} />;
  const supabase = await createClient();
  const [packages, rules, assessments, quotes, clients, leads, assess, manageRules, createQuote, editQuote, sendQuote] = await Promise.all([
    supabase.from("engagement_type_settings").select("id,name,pricing_method,pricing_config").eq("workspace_id", workspace.workspace.id).eq("is_active", true).order("name"),
    supabase.from("pricing_rules").select("id,engagement_type_setting_id,name,description,condition,adjustment_type,amount,amount_max,sort_order,is_active").eq("workspace_id", workspace.workspace.id).order("sort_order"),
    supabase.from("pricing_assessments").select("id,client_id,lead_id,status,recommended_min,recommended_max,recommended_price,created_at,client:clients(first_name,last_name,company),lead:leads(first_name,last_name,company)").eq("workspace_id", workspace.workspace.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("client_quotes").select("id,client_id,pricing_assessment_id,quote_number,quote_type,pricing_method,amount,amount_min,amount_max,status,valid_until,created_at,client:clients(first_name,last_name,company)").eq("workspace_id", workspace.workspace.id).order("created_at", { ascending: false }).limit(100),
    supabase.from("clients").select("id,first_name,last_name,company").eq("workspace_id", workspace.workspace.id).neq("status", "archived").order("last_name"),
    supabase.from("leads").select("id,first_name,last_name,company").eq("workspace_id", workspace.workspace.id).not("status", "in", "(won,lost)").order("last_name"),
    requirePermission(workspace.workspace.id, "pricing.assess"), requirePermission(workspace.workspace.id, "pricing.rules"), requirePermission(workspace.workspace.id, "quotes.create"), requirePermission(workspace.workspace.id, "quotes.edit"), requirePermission(workspace.workspace.id, "quotes.send"),
  ]);
  const label = (row: { first_name?: string | null; last_name?: string | null; company?: string | null }) => row.company || `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "Unnamed";
  const people: PricingPerson[] = [
    ...(clients.data ?? []).map((row) => ({ id: row.id, label: label(row), kind: "client" as const })),
    ...(leads.data ?? []).map((row) => ({ id: row.id, label: label(row), kind: "lead" as const })),
  ];
  return <PricingWorkspace packages={(packages.data ?? []) as PricingPackage[]} rules={(rules.data ?? []) as PricingRule[]} assessments={(assessments.data ?? []) as unknown as AssessmentSummary[]} quotes={(quotes.data ?? []) as unknown as QuoteSummary[]} people={people} permissions={{ assess: assess.allowed, rules: manageRules.allowed, createQuote: createQuote.allowed, editQuote: editQuote.allowed, sendQuote: sendQuote.allowed }} />;
}
