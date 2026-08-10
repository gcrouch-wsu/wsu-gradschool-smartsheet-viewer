"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ADMIN_TABLE_PAGE_SIZE,
  AdminDataTable,
  resolveAdminTablePage,
} from "@/components/admin/AdminDataTable";
import { EmptyState } from "@/components/admin/WorkspacePrimitives";
import { StudentLoginForm } from "@/components/forms/student/StudentLoginForm";

type SheetSummary = {
  sheetId: string;
  name: string;
  slug: string;
  ownedRowCount: number;
};

export function StudentSheetTable({
  initialEmail,
  page = "1",
}: {
  initialEmail: string | null;
  page?: string;
}) {
  const [sheets, setSheets] = useState<SheetSummary[]>([]);
  const [email, setEmail] = useState(initialEmail);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(Boolean(initialEmail));
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/forms/student/sheets");
      const data = (await response.json().catch(() => null)) as {
        email?: string;
        sheets?: SheetSummary[];
        error?: string;
      } | null;
      if (!response.ok) {
        if (response.status === 401) {
          setEmail(null);
          setSheets([]);
          return;
        }
        throw new Error(data?.error ?? "Unable to load your submissions.");
      }
      setEmail(data?.email ?? null);
      setSheets(Array.isArray(data?.sheets) ? data.sheets : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load your submissions.");
      setSheets([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialEmail) void load();
  }, [initialEmail, load]);

  const matchingSheets = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term ? sheets.filter((sheet) => sheet.name.toLowerCase().includes(term)) : sheets;
  }, [query, sheets]);
  const currentPage = resolveAdminTablePage(page, matchingSheets.length);

  if (!email) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-[color:var(--wsu-border)] bg-white p-6 shadow-sm sm:p-8">
        <StudentLoginForm returnHref="/forms/my" />
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="flex flex-col gap-4 border-b border-line px-5 py-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-crimson">Student portal</p>
          <h2 className="mt-1 text-xl font-semibold text-ink">My submission sheets</h2>
          <p className="mt-1 text-sm text-sub">Sheets that contain your Student Email.</p>
        </div>
        <label className="block w-full sm:max-w-xs">
          <span className="sr-only">Search submission sheets</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search sheets…"
            className="w-full rounded-lg border border-line bg-white px-3 py-2.5 text-sm outline-none transition focus:border-crimson focus:ring-1 focus:ring-crimson"
          />
        </label>
      </div>

      {loading ? <p className="px-5 py-6 text-sm text-sub">Loading submissions…</p> : null}
      {error ? <p role="alert" className="m-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p> : null}
      {!loading && !error ? (
        <AdminDataTable
          headers={["Sheet", "My rows", "Open"]}
          items={matchingSheets}
          page={currentPage}
          basePath="/forms/my"
          pageSize={ADMIN_TABLE_PAGE_SIZE}
          columns={3}
          endAlignLastHeader
          getRowKey={(sheet) => sheet.sheetId}
          empty={
            <EmptyState
              icon={<span className="text-sm font-semibold">S</span>}
              title="No submission sheets found"
              description="There are no available sheets where your Student Email appears."
              variant="panel"
            />
          }
          renderRow={(sheet) => (
            <>
              <div className="min-w-0">
                <p className="font-medium text-ink">{sheet.name}</p>
                <p className="mt-1 text-xs text-sub">Submission sheet</p>
              </div>
              <p className="text-sm text-sub">
                {sheet.ownedRowCount} submission{sheet.ownedRowCount === 1 ? "" : "s"}
              </p>
              <div className="sm:text-right">
                <Link
                  href={`/forms/my/${encodeURIComponent(sheet.sheetId)}`}
                  className="inline-flex rounded-lg border border-line-strong bg-white px-3 py-2 text-sm font-medium text-ink transition hover:border-mist hover:bg-[#faf7f8]"
                >
                  Open
                </Link>
              </div>
            </>
          )}
        />
      ) : null}
    </section>
  );
}
