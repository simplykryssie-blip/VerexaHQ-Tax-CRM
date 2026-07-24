import { Loader2 } from "lucide-react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-white px-6 py-14 text-center">
      <Loader2 className="size-5 animate-spin text-accent-600" />
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}
