import Link from "next/link";
import { History } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/LegacyCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { clientDisplayName, formatRelativeTime, titleCase } from "@/lib/utils";
import type { ReviewActivityItem } from "@/lib/data/dashboard";

export function RecentReviewActivityCard({ activity }: { activity: ReviewActivityItem[] }) {
  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-foreground">Recent review activity</h2>
      </CardHeader>
      <CardBody className="p-0">
        {activity.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={History} title="No review activity yet" description="Actions taken during intake review will appear here." />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {activity.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/intakes/${item.submissionId}`}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-accent-50/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {titleCase(item.actionType)}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {item.client ? clientDisplayName(item.client) : "Unknown client"}
                      {item.taxYear ? ` · Tax year ${item.taxYear}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">
                    {formatRelativeTime(item.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
