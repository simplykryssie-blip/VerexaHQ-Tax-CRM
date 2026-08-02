import Link from "next/link";
import { ClipboardCheck, FileCheck2, PenTool, Receipt } from "lucide-react";
import { requireWorkspace } from "@/lib/auth/workspace";
import { requirePermission } from "@/lib/permissions/granular";
import { ForbiddenState } from "@/components/ui/ForbiddenState";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function ReviewReleasePage() {
  const context = await requireWorkspace();
  if (!context.workspace) return <ForbiddenState description="No active workspace was found." />;
  const workspaceId = context.workspace.workspace.id;
  const access = await requirePermission(workspaceId, "reviews.view");
  if (!access.allowed) return <ForbiddenState description={access.reason} />;
  const supabase = await createClient();
  const [reviews, signatures, invoices, releases] = await Promise.all([
    supabase.from("ero_reviews").select("id", { count: "exact", head: true }).eq("ero_workspace_id", workspaceId).in("status", ["pending_review", "needs_revision"]),
    supabase.from("signature_requests").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("status", ["sent", "partially_signed"]),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).in("status", ["sent", "viewed", "partially_paid", "past_due"]),
    supabase.from("return_release_controls").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).is("released_at", null),
  ]);
  const cards = [
    { title: "ERO review queue", count: reviews.count ?? 0, href: "/ero-review", icon: ClipboardCheck, text: "Compliance review, corrections, reassignment, and approval." },
    { title: "Pending signatures", count: signatures.count ?? 0, href: "/signatures", icon: PenTool, text: "Ordinary engagement letters and signer progress." },
    { title: "Open invoices", count: invoices.count ?? 0, href: "/billing", icon: Receipt, text: "Balances, payments, refunds, voids, and financial tracking." },
    { title: "Return release checks", count: releases.count ?? 0, href: "/engagements", icon: FileCheck2, text: "Payment, signature, review, and filing blockers before release." },
  ];
  return <div className="space-y-5"><div><h1 className="text-2xl font-semibold tracking-tight">Review & Return Release</h1><p className="text-sm text-muted-foreground mt-1">The final operational queue from review through client delivery.</p></div><div className="grid gap-4 md:grid-cols-2">{cards.map((item) => <Card key={item.href}><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="flex items-center gap-2 text-base"><item.icon className="h-4 w-4" />{item.title}</CardTitle><span className="text-2xl font-semibold">{item.count}</span></CardHeader><CardContent><p className="mb-3 text-sm text-muted-foreground">{item.text}</p><Button asChild size="sm" variant="outline"><Link href={item.href}>Open queue</Link></Button></CardContent></Card>)}</div></div>;
}
