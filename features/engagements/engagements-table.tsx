"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toast } from "@/components/ui/toaster";
import { engagementStatusLabel } from "@/lib/validation/engagements";
import { eroReviewStatusLabel } from "@/lib/validation/ero-review";
import { formatDate } from "@/lib/formatters";
import { sendEngagementsForEroReview } from "@/features/engagements/send-for-ero-review";
import type { Enums } from "@/types/database";

type EngagementRow = {
  id: string;
  engagement_number: string | null;
  title: string;
  tax_year: number | null;
  return_type: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  ero_review_status: Enums<"ero_review_status">;
  client: { first_name?: string | null; last_name?: string | null; company?: string | null } | null;
};

export function EngagementsTable({
  engagements,
  workspaceId,
  linkedEro,
}: {
  engagements: EngagementRow[];
  workspaceId: string;
  linkedEro: { workspaceId: string; name: string } | null;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const statuses = useMemo(() => Array.from(new Set(engagements.map((e) => e.status))).sort(), [engagements]);

  const visible = useMemo(
    () => (statusFilter === "all" ? engagements : engagements.filter((e) => e.status === statusFilter)),
    [engagements, statusFilter],
  );

  const eligibleIds = useMemo(
    () => visible.filter((e) => e.ero_review_status === "not_submitted" || e.ero_review_status === "needs_revision").map((e) => e.id),
    [visible],
  );
  const allEligibleSelected = eligibleIds.length > 0 && eligibleIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allEligibleSelected ? new Set() : new Set(eligibleIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendSelected() {
    if (!linkedEro || selected.size === 0) return;
    setSending(true);
    try {
      await sendEngagementsForEroReview(Array.from(selected), workspaceId, linkedEro.workspaceId);
      toast.success(`Sent ${selected.size} engagement${selected.size === 1 ? "" : "s"} for ERO review`);
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send for review. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {engagementStatusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {linkedEro && (
            <Button size="sm" variant="outline" disabled={eligibleIds.length === 0} onClick={toggleAll}>
              {allEligibleSelected ? "Deselect all" : `Select all (${eligibleIds.length})`}
            </Button>
          )}
        </div>
        {linkedEro && selected.size > 0 && (
          <Button size="sm" variant="brand" disabled={sending} onClick={sendSelected}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send {selected.size} for ERO review
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {linkedEro && <TableHead className="w-8"></TableHead>}
              <TableHead>Engagement</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Tax year</TableHead>
              <TableHead>Return type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due date</TableHead>
              {linkedEro && <TableHead>ERO review</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((e) => {
              const client = e.client;
              const canSelect = e.ero_review_status === "not_submitted" || e.ero_review_status === "needs_revision";
              return (
                <TableRow key={e.id}>
                  {linkedEro && (
                    <TableCell>
                      {canSelect && <Checkbox checked={selected.has(e.id)} onCheckedChange={() => toggleOne(e.id)} />}
                    </TableCell>
                  )}
                  <TableCell>
                    <Link href={`/engagements/${e.id}`} className="font-medium hover:underline">
                      {e.engagement_number ?? e.title}
                    </Link>
                  </TableCell>
                  <TableCell>{client?.company || `${client?.first_name ?? ""} ${client?.last_name ?? ""}`.trim() || "—"}</TableCell>
                  <TableCell>{e.tax_year}</TableCell>
                  <TableCell>{e.return_type}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{engagementStatusLabel(e.status)}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{e.priority}</TableCell>
                  <TableCell>{formatDate(e.due_date)}</TableCell>
                  {linkedEro && (
                    <TableCell>
                      <Badge
                        variant={
                          e.ero_review_status === "approved" ? "success" : e.ero_review_status === "needs_revision" ? "destructive" : "secondary"
                        }
                      >
                        {eroReviewStatusLabel(e.ero_review_status)}
                      </Badge>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
