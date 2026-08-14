"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  resolveAdminTablePage,
} from "@/components/admin/AdminDataTable";
import { EmptyState } from "@/components/admin/WorkspacePrimitives";
import {
  STUDENT_SHEET_TOUR_STEPS,
  STUDENT_SHEET_TOUR_STORAGE_KEY,
} from "@/components/forms/student/student-tours";
import { ProductTour } from "@/components/ui/ProductTour";
import { TourHowToButton } from "@/components/ui/ProductTourHost";
import { useProductTour } from "@/hooks/useProductTour";

type RowSummary = {
  rowId: number;
  label: string;
  createdAt: string | null;
  overall: string;
  approvalStatus: { label: string; state: string };
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(value));
}

export function StudentSubmissionTable({
  sheetId,
  page = "1",
}: {
  sheetId: string;
  page?: string;
}) {
  const [sheetName, setSheetName] = useState("");
  const [rows, setRows] = useState<RowSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const tour = useProductTour(STUDENT_SHEET_TOUR_STORAGE_KEY, { enabled: !loading });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/forms/student/sheets/${encodeURIComponent(sheetId)}/rows`);
      const data = (await response.json().catch(() => null)) as {
        name?: string;
        rows?: RowSummary[];
        error?: string;
      } | null;
      if (!response.ok) throw new Error(data?.error ?? "Unable to load your submissions.");
      setSheetName(data?.name ?? "Submission sheet");
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your submissions.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [sheetId]);

  useEffect(() => {
    void load();
  }, [load]);

  const matchingRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) =>
      [row.label, row.overall, row.approvalStatus?.label].filter(Boolean).join(" ").toLowerCase().includes(term),
    );
  }, [query, rows]);
  const currentPage = resolveAdminTablePage(page, matchingRows.length);
  const basePath = `/forms/my/${encodeURIComponent(sheetId)}`;

  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="flex flex-col gap-4 border-b border-line px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div data-tour="ss-heading">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-crimson">Submission sheet</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">{sheetName || "My submissions"}</h2>
          <p className="mt-1 text-sm text-sub">Select a submission to view its details or propose a reroute.</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:max-w-xs">
          <TourHowToButton onClick={tour.startTour} />
          <label className="block w-full" data-tour="ss-search">
            <span className="sr-only">Search submissions</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search submissions…"
              className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:border-crimson focus:ring-1 focus:ring-crimson"
            />
          </label>
        </div>
      </div>
      {loading ? <p className="px-5 py-6 text-sm text-sub">Loading submissions…</p> : null}
      {error ? (
        <p role="alert" className="m-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </p>
      ) : null}
      {!loading && !error ? (
        <div data-tour="ss-table">
          <AdminDataTable
            headers={["Submission", "Status", "Submitted", "Open"]}
            items={matchingRows}
            page={currentPage}
            basePath={basePath}
            pageSize={ADMIN_TABLE_PAGE_SIZE}
            columns={4}
            endAlignLastHeader
            getRowKey={(row) => String(row.rowId)}
            empty={
              <EmptyState
                icon={<span className="text-sm font-semibold">M</span>}
                title="No matching submissions"
                description="Try a different search, or return to My submissions to choose another sheet."
                variant="panel"
              />
            }
            renderRow={(row) => (
              <>
                <p className="min-w-0 font-medium text-ink">{row.label}</p>
                <p className="text-sm text-sub">{row.approvalStatus?.label || row.overall || "In review"}</p>
                <p className="text-sm text-sub">{formatDate(row.createdAt)}</p>
                <div className="sm:text-right">
                  <Link
                    href={`${basePath}/${row.rowId}`}
                    data-tour="ss-view"
                    className="inline-flex rounded-lg border border-line-strong bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-mist hover:bg-[#faf7f8]"
                  >
                    View
                  </Link>
                </div>
              </>
            )}
          />
        </div>
      ) : null}

      <ProductTour
        open={tour.open}
        steps={STUDENT_SHEET_TOUR_STEPS}
        stepIndex={tour.stepIndex}
        onStepIndexChange={tour.setStepIndex}
        onClose={tour.closeTour}
        onComplete={tour.completeTour}
      />
    </section>
  );
}
