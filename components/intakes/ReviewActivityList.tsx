import { formatRelativeTime, titleCase } from "@/lib/utils";
import type { FormField, IntakeReviewAction } from "@/lib/types";
import type { UserSummary } from "@/lib/data/users";

export function ReviewActivityList({
  actions,
  userMap,
}: {
  actions: (IntakeReviewAction & { field: FormField | null })[];
  userMap: Map<string, UserSummary>;
}) {
  if (actions.length === 0) {
    return <p className="text-sm text-muted">No activity yet.</p>;
  }

  return (
    <ul className="space-y-3">
      {actions.slice(0, 10).map((action) => (
        <li key={action.id} className="text-sm">
          <p className="text-foreground">
            <span className="font-medium">
              {action.created_by ? userMap.get(action.created_by)?.name ?? "Staff member" : "System"}
            </span>{" "}
            {titleCase(action.action_type).toLowerCase()}
            {action.field?.label ? ` · ${action.field.label}` : ""}
          </p>
          <p className="text-xs text-muted">{formatRelativeTime(action.created_at)}</p>
        </li>
      ))}
    </ul>
  );
}
