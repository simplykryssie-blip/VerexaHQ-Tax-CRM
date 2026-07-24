export function IntakeProgress({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-full max-w-40 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-accent-600 transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="shrink-0 text-xs font-medium tabular-nums text-muted">{clamped}%</span>
    </div>
  );
}
