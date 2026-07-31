import { formatDateTime } from "@/lib/utils";
import type { EngagementActivity } from "@/lib/types";
import type { UserSummary } from "@/lib/data/users";

export function EngagementActivityList({
  activity,
  userMap,
}: {
  activity: EngagementActivity[];
  userMap: Map<string, UserSummary>;
}) {
  if (activity.length === 0) {
    return <p className="text-sm text-muted">No activity recorded yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {activity.map((entry) => (
        <li key={entry.id} className="border-b border-border pb-3 last:border-0">
          <p className="text-sm text-foreground">{entry.description ?? entry.activity_type.replace(/_/g, " ")}</p>
          <p className="text-xs text-muted">
            {entry.changed_by ? userMap.get(entry.changed_by)?.name ?? "Staff member" : "System"} ·{" "}
            {formatDateTime(entry.changed_at)}
          </p>
        </li>
      ))}
    </ul>
  );
}
