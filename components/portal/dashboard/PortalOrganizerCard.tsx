import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/LegacyButton";
import { IntakeProgress } from "@/components/intakes/IntakeProgress";
import type { IntakeSubmission } from "@/lib/types";

/**
 * The one clear card the client sees on their dashboard for the guided tax
 * organizer (Part 2) — a single, unambiguous next action rather than a
 * maze of organizer-related links.
 */
export function PortalOrganizerCard({ organizer }: { organizer: IntakeSubmission | null }) {
  if (!organizer) return null;

  const actionLabel =
    organizer.status === "not_started"
      ? "Start Organizer"
      : ["in_progress", "changes_requested", "resubmitted"].includes(organizer.status)
        ? "Continue Organizer"
        : "View Organizer";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-50 text-accent-600">
          <ClipboardList className="size-5" />
        </div>
        <div className="space-y-2">
          <p className="text-base font-semibold text-foreground">
            Complete your {organizer.tax_year ?? ""} Tax Organizer
          </p>
          <IntakeProgress percent={Math.round(organizer.progress_percent)} />
        </div>
      </div>
      <Link href={`/portal/organizer/${organizer.id}`} className="shrink-0">
        <Button className="w-full sm:w-auto">{actionLabel}</Button>
      </Link>
    </div>
  );
}
