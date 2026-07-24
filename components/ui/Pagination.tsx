import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  pageSize,
  total,
  buildHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  buildHref: (page: number) => string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted">
      <p>
        {total === 0 ? (
          "No results"
        ) : (
          <>
            Showing <span className="font-medium text-foreground">{from}</span>–
            <span className="font-medium text-foreground">{to}</span> of{" "}
            <span className="font-medium text-foreground">{total}</span>
          </>
        )}
      </p>
      <div className="flex items-center gap-1">
        <PaginationLink
          href={buildHref(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
        </PaginationLink>
        <span className="px-2 tabular-nums">
          {page} / {totalPages}
        </span>
        <PaginationLink
          href={buildHref(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight className="size-4" />
        </PaginationLink>
      </div>
    </div>
  );
}

function PaginationLink({
  href,
  disabled,
  children,
  ...props
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const classes = cn(
    "flex size-8 items-center justify-center rounded-lg border border-border",
    disabled
      ? "pointer-events-none text-slate-300"
      : "text-foreground hover:bg-slate-50",
  );

  if (disabled) {
    return (
      <span className={classes} aria-disabled>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}
