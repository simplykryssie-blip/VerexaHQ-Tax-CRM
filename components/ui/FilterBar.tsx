import { cn } from "@/lib/utils";

export function FilterBar({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface p-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export const selectClassName =
  "rounded-lg border border-border bg-white px-2.5 py-1.5 text-sm text-foreground shadow-sm focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20";
