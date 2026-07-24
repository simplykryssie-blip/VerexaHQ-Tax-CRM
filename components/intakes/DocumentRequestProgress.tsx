export function DocumentRequestProgress({
  received,
  total,
}: {
  received: number;
  total: number;
}) {
  const percent = total === 0 ? 0 : Math.round((received / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-muted">
        <span>
          {received} of {total} received
        </span>
        <span className="font-medium tabular-nums">{percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-accent-600 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
