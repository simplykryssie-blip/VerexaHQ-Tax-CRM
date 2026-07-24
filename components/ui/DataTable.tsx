import { cn } from "@/lib/utils";

export type DataTableColumn<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
};

/**
 * Plain server-renderable table. Callers add an explicit action column
 * (e.g. an "Open" link) for row-level navigation rather than relying on
 * whole-row click handlers, which keeps this a Server Component.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-medium uppercase tracking-wide text-muted">
            {columns.map((column) => (
              <th key={column.key} className={cn("px-5 py-3", column.className)}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-accent-50/30">
              {columns.map((column) => (
                <td key={column.key} className={cn("px-5 py-3.5 align-middle", column.className)}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
