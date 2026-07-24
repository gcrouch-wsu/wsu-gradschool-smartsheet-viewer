import Link from "next/link";
import type { ReactNode } from "react";
import { TableShell } from "@/components/admin/WorkspacePrimitives";

export const ADMIN_TABLE_PAGE_SIZE = 10;

/** Resolve a 1-based page number from `?page=` against a total item count. */
export function resolveAdminTablePage(
  rawPage: string | undefined,
  totalItems: number,
  pageSize: number = ADMIN_TABLE_PAGE_SIZE,
): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const requested = Number.parseInt(rawPage ?? "1", 10);
  if (!Number.isFinite(requested)) return 1;
  return Math.min(totalPages, Math.max(1, requested));
}

function pageHref(basePath: string, page: number): string {
  if (page <= 1) return basePath;
  const sep = basePath.includes("?") ? "&" : "?";
  return `${basePath}${sep}page=${page}`;
}

export function AdminDataTable<T>({
  headers,
  items,
  page,
  basePath,
  pageSize = ADMIN_TABLE_PAGE_SIZE,
  columns,
  endAlignLastHeader = false,
  empty,
  getRowKey,
  renderRow,
  className = "",
}: {
  headers: string[];
  items: T[];
  /** Current 1-based page (already clamped). */
  page: number;
  /** Path for pagination links, e.g. `/admin/sources`. */
  basePath: string;
  pageSize?: number;
  columns?: number;
  endAlignLastHeader?: boolean;
  empty: ReactNode;
  getRowKey: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  className?: string;
}) {
  const colCount = Math.min(6, Math.max(2, columns ?? headers.length));
  const smColsClass =
    colCount === 2
      ? "sm:grid-cols-2"
      : colCount === 3
        ? "sm:grid-cols-3"
        : colCount === 4
          ? "sm:grid-cols-4"
          : colCount === 5
            ? "sm:grid-cols-5"
            : "sm:grid-cols-6";

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(totalPages, Math.max(1, page));
  const start = (currentPage - 1) * pageSize;
  const pageItems = items.slice(start, start + pageSize);
  const showingFrom = items.length === 0 ? 0 : start + 1;
  const showingTo = Math.min(start + pageSize, items.length);
  const showPager = items.length > pageSize;

  return (
    <TableShell
      headers={headers}
      columns={colCount}
      endAlignLastHeader={endAlignLastHeader}
      className={className}
    >
      {items.length === 0 ? (
        <div className="p-5">{empty}</div>
      ) : (
        <>
          <div className="divide-y divide-line">
            {pageItems.map((item) => (
              <div
                key={getRowKey(item)}
                className={`grid grid-cols-2 gap-3 px-5 py-4 transition hover:bg-[#fdfafb] ${smColsClass} sm:items-center`}
              >
                {renderRow(item)}
              </div>
            ))}
          </div>

          {showPager ? (
            <div className="flex flex-col gap-3 border-t border-line bg-[#fbf9fa] px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-sub">
                Showing {showingFrom}–{showingTo} of {items.length}
              </p>
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link
                    href={pageHref(basePath, currentPage - 1)}
                    className="rounded-full border border-line-strong bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:border-mist hover:bg-[#faf7f8]"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="rounded-full border border-line bg-white/60 px-3 py-1.5 text-sm font-medium text-mist">
                    Previous
                  </span>
                )}
                <span className="font-mono text-xs uppercase tracking-wide text-sub">
                  Page {currentPage} of {totalPages}
                </span>
                {currentPage < totalPages ? (
                  <Link
                    href={pageHref(basePath, currentPage + 1)}
                    className="rounded-full border border-line-strong bg-white px-3 py-1.5 text-sm font-medium text-ink transition hover:border-mist hover:bg-[#faf7f8]"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="rounded-full border border-line bg-white/60 px-3 py-1.5 text-sm font-medium text-mist">
                    Next
                  </span>
                )}
              </div>
            </div>
          ) : items.length > 0 ? (
            <div className="border-t border-line bg-[#fbf9fa] px-5 py-3">
              <p className="text-sm text-sub">
                Showing {showingFrom}–{showingTo} of {items.length}
              </p>
            </div>
          ) : null}
        </>
      )}
    </TableShell>
  );
}
