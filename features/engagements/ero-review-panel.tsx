"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toaster";
import { formatDateTime } from "@/lib/formatters";
import { eroReviewStatusLabel } from "@/lib/validation/ero-review";
import { sendEngagementsForEroReview } from "@/features/engagements/send-for-ero-review";
import { reviewEroSubmission } from "@/features/engagements/ero-review-actions";
import type { MembershipRole } from "@/lib/permissions/roles";
import type { Enums, Tables } from "@/types/database";

const ERO_UPDATE_ROLES: MembershipRole[] = ["owner", "admin", "ero"];

export function EroReviewPanel({
  engagementId,
  engagementWorkspaceId,
  eroReviewStatus,
  reviews,
  linkedEro,
  viewerWorkspaceId,
  viewerRole,
}: {
  engagementId: string;
  engagementWorkspaceId: string;
  eroReviewStatus: Enums<"ero_review_status">;
  reviews: Tables<"ero_reviews">[];
  linkedEro: { workspaceId: string; name: string } | null;
  viewerWorkspaceId: string | null;
  viewerRole: MembershipRole | null;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [deciding, setDeciding] = useState(false);

  const latest = reviews[0] ?? null;
  const isPtinSide = viewerWorkspaceId === engagementWorkspaceId;
  const isEroSide = !!linkedEro && viewerWorkspaceId === linkedEro.workspaceId;
  const canSend = isPtinSide && !!linkedEro && (eroReviewStatus === "not_submitted" || eroReviewStatus === "needs_revision");
  const canDecide = isEroSide && latest?.status === "pending_review" && !!viewerRole && ERO_UPDATE_ROLES.includes(viewerRole);

  async function send() {
    if (!linkedEro) return;
    setSending(true);
    try {
      await sendEngagementsForEroReview([engagementId], engagementWorkspaceId, linkedEro.workspaceId);
      toast.success(`Sent to ${linkedEro.name} for review`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send for review. Please try again.");
    } finally {
      setSending(false);
    }
  }

  async function approve() {
    if (!latest) return;
    setDeciding(true);
    try {
      await reviewEroSubmission(latest.id, "approved", null);
      toast.success("Engagement approved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record approval. Please try again.");
    } finally {
      setDeciding(false);
    }
  }

  async function requestRevision() {
    if (!latest || !comment.trim()) return;
    setDeciding(true);
    try {
      await reviewEroSubmission(latest.id, "needs_revision", comment.trim());
      toast.success("Sent back for revision");
      setDecisionOpen(false);
      setComment("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't record decision. Please try again.");
    } finally {
      setDeciding(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">ERO review</CardTitle>
          {linkedEro && <CardDescription>Oversight by {linkedEro.name}</CardDescription>}
        </div>
        <div className="flex items-center gap-2">
          {canSend && (
            <Button size="sm" variant="brand" disabled={sending} onClick={send}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send for review
            </Button>
          )}
          {canDecide && (
            <>
              <Button size="sm" variant="outline" disabled={deciding} onClick={approve}>
                <CheckCircle2 className="h-4 w-4" /> Approve
              </Button>
              <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="destructive" disabled={deciding}>
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
                    <Button variant="brand" disabled={deciding || !comment.trim()} onClick={requestRevision}>
                      {deciding && <Loader2 className="h-4 w-4 animate-spin" />}
                      Send back
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <Badge
          variant={eroReviewStatus === "approved" ? "success" : eroReviewStatus === "needs_revision" ? "destructive" : "secondary"}
        >
          Current: {eroReviewStatusLabel(eroReviewStatus)}
        </Badge>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">No review history yet.</p>
        ) : (
          <ul className="space-y-1.5 text-sm mt-2">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-md border border-border p-2">
                <div className="flex items-center justify-between">
                  <Badge variant={r.status === "approved" ? "success" : r.status === "needs_revision" ? "destructive" : "secondary"}>
                    {eroReviewStatusLabel(r.status)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Submitted {formatDateTime(r.submitted_at)}
                    {r.reviewed_at && ` · Reviewed ${formatDateTime(r.reviewed_at)}`}
                  </span>
                </div>
                {r.comment && <p className="text-xs text-destructive mt-1">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
