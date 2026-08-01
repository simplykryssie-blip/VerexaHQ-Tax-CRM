import { ShieldAlert } from "lucide-react";

export function ForbiddenState({
  description = "You don't have permission to view this page in the current workspace.",
}: {
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-amber-200 bg-amber-50/40 px-6 py-14 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <ShieldAlert className="size-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Access restricted</p>
        <p className="max-w-sm text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}
