import { Users, FileText, ClipboardCheck, MessageCircleWarning, CheckCircle2, FolderOpen, PlayCircle, Send } from "lucide-react";
import { MetricCard } from "@/components/ui/MetricCard";
import type { DashboardMetrics } from "@/lib/data/dashboard";

export function MetricsGrid({ metrics }: { metrics: DashboardMetrics }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      <MetricCard label="Active clients" value={metrics.activeClients} icon={Users} tone="accent" href="/clients" />
      <MetricCard label="Not started" value={metrics.intakesNotStarted} icon={FileText} href="/intakes?status=not_started" />
      <MetricCard label="In progress" value={metrics.intakesInProgress} icon={PlayCircle} href="/intakes?status=in_progress" />
      <MetricCard label="Submitted" value={metrics.intakesSubmitted} icon={Send} href="/intakes?status=submitted" />
      <MetricCard label="Under review" value={metrics.intakesUnderReview} icon={ClipboardCheck} tone="warning" href="/intakes?status=under_review" />
      <MetricCard label="Needs clarification" value={metrics.intakesNeedingClarification} icon={MessageCircleWarning} tone="warning" href="/intakes?status=changes_requested" />
      <MetricCard label="Approved" value={metrics.intakesApproved} icon={CheckCircle2} tone="accent" href="/intakes?status=approved" />
      <MetricCard label="Open document requests" value={metrics.openDocumentRequests} icon={FolderOpen} tone="danger" href="/document-requests" />
    </div>
  );
}
