"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { formatDateTime } from "@/lib/formatters";
import { eroReviewStatusLabel } from "@/lib/validation/ero-review";
import { reviewEroSubmission } from "@/features/engagements/ero-review-actions";
import type { Enums } from "@/types/database";

export type EroInboxRow = {
  id: string;
  status: Enums<"ero_review_status">;
  comment: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  ptin_workspace: { name: string } | null;
  engagement: {
    id: string;
    engagement_number: string | null;
    title: string;
    tax_year: number | null;
    return_type: string | null;
    client: { first_name?: string | null; last_name?: string | null; company?: string | null } | null;
  } | null;
};

export function EroReviewInbox({ rows, canDecide }: { rows: EroInboxRow[]; canDecide: boolean }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("pending_review");
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<EroInboxRow | null>(null);
  const [comment, setComment] = useState("");

  const visible = useMemo(() => (statusFilter === "all" ? rows : rows.filter((r) => r.status === statusFilter)), [rows, statusFilter]);

  async function approve(row: EroInboxRow) {
    setDecidingId(row.id);
    try {
      await reviewEroSubmission(row.id, "approved", null);
      toast.success("Engagement approved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record approval. Please try again.");
    } finally {
      setDecidingId(null);
    }
  }

  async function requestRevision() {
    if (!revisionTarget || !comment.trim()) return;
    setDecidingId(revisionTarget.id);
    try {
      await reviewEroSubmission(revisionTarget.id, "needs_revision", comment.trim());
      toast.success("Sent back for revision");
      setRevisionTarget(null);
      setComment("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record decision. Please try again.");
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-56 h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="pending_review">Pending review</SelectItem>
          <SelectItem value="needs_revision">Needs revision</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="all">All</SelectItem>
        </SelectContent>
      </Select>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Nothing here.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {visible.map((r) => {
            const client = r.engagement?.client;
            const clientName = client?.company || `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim() || "—";
            return (
              <li key={r.id} className="p-3 flex items-center justify-between gap-3 flex-wrap text-sm">
                <div>
                  {r.engagement ? (
                    <Link href={`/engagements/${r.engagement.id}`} className="font-medium hover:underline">
                      {r.engagement.engagement_number ?? r.engagement.title}
                    </Link>
                  ) : (
                    <span className="font-medium text-muted-foreground">Engagement removed</span>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {clientName} · {r.ptin_workspace?.name ?? "—"} · Submitted {formatDateTime(r.submitted_at)}
                  </div>
                  {r.comment && <p className="text-xs text-destructive mt-1">{r.comment}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={r.status === "approved" ? "success" : r.status === "needs_revision" ? "destructive" : "secondary"}>
                    {eroReviewStatusLabel(r.status)}
                  </Badge>
                  {canDecide && r.status === "pending_review" && (
                    <>
                      <Button size="sm" variant="outline" disabled={decidingId === r.id} onClick={() => approve(r)}>
                        {decidingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                        Approve
                      </Button>
                      <Dialog
                        open={revisionTarget?.id === r.id}
                        onOpenChange={(open) => {
                          setRevisionTarget(open ? r : null);
                          if (!open) setComment("");
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button size="sm" variant="destructive" disabled={decidingId === r.id}>
                            <XCircle className="h-4 w-4" /> Needs revision
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Send back for revision</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-1">
                            <Label>What needs to change?</Label>
                            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="Explain what the preparer needs to fix..." />
                          </div>
                          <DialogFooter>
                            <Button variant="brand" disabled={decidingId === r.id || !comment.trim()} onClick={requestRevision}>
                              {decidingId === r.id && <Loader2 className="h-4 w-4 animate-spin" />}
                              Send back
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
