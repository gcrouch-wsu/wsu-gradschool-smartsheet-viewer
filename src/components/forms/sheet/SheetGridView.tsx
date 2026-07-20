"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { approvalTone, approvalToneLabel, type ApprovalTone } from "@/lib/forms/approval-style";
import { IconSearch } from "@/components/forms/icons";

export interface SheetGridColumn {
  id: number;
  title: string;
  type: string;
  primary?: boolean;
  workflowRole: "stage" | "overall" | "form" | null;
}

export interface SheetGridRow {
  id: number;
  rowNumber?: number | null;
  createdAt?: string | null;
  modifiedAt?: string | null;
  values: Record<string, string>;
  approvalStatus?: {
    label: string;
    stage: string;
    value: string;
    state: string;
  } | null;
}

export interface SheetGridWorkflow {
  approvalStages: string[];
  overallColumn: string;
  source?: string;
}

interface SheetGridViewProps {
  sheetName: string;
  demo: boolean;
  columns: SheetGridColumn[];
  rows: SheetGridRow[];
  workflow: SheetGridWorkflow | null;
  totalRowCount: number | null;
  approvedValues: string[];
  declinedValues: string[];
  onRowClick?: (row: SheetGridRow) => void;
}

type ColumnFilter = "all" | "form" | "workflow";
type StatusFilter = "all" | "current" | "complete" | "declined";

function toneCellClasses(tone: ApprovalTone | null, highlight: boolean): string {
  if (!highlight || !tone || tone === "empty") {
    return "text-[color:var(--wsu-ink)]";
  }
  switch (tone) {
    case "approved":
      return "bg-emerald-50/90 text-emerald-900";
    case "declined":
      return "bg-red-50/90 text-red-900";
    case "pending":
      return "bg-amber-50/90 text-amber-950";
    default:
      return "text-[color:var(--wsu-muted)]";
  }
}

function toneBorderClass(tone: ApprovalTone | null, highlight: boolean): string {
  if (!highlight || !tone || tone === "empty") return "";
  switch (tone) {
    case "approved":
      return "border-l-2 border-l-emerald-400";
    case "declined":
      return "border-l-2 border-l-red-400";
    case "pending":
      return "border-l-2 border-l-amber-400";
    default:
      return "";
  }
}

function approvalBadgeClass(state: string): string {
  switch (state) {
    case "complete":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "declined":
      return "bg-red-50 text-red-800 ring-red-200";
    default:
      return "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)] ring-[color:var(--wsu-border)]";
  }
}

function LegendChip({ label, className }: { label: string; className: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      {label}
    </span>
  );
}

function StatusStat({
  label,
  value,
  tone,
  selected,
  onSelect,
}: {
  label: string;
  value: number;
  tone?: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={[
        "px-4 py-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wsu-crimson",
        selected
          ? "bg-[color:var(--wsu-stone)]/80 ring-1 ring-inset ring-wsu-crimson/35"
          : "bg-white hover:bg-[color:var(--wsu-stone)]/40",
      ].join(" ")}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[color:var(--wsu-muted)]">{label}</p>
      <p className={`mt-1 font-mono text-xl font-medium tabular-nums leading-none tracking-tight ${tone ?? "text-[color:var(--wsu-ink)]"}`}>
        {value}
      </p>
      {selected ? <span className="sr-only">(selected filter)</span> : null}
    </button>
  );
}

export function SheetGridView({
  sheetName,
  demo,
  columns,
  rows,
  workflow,
  totalRowCount,
  approvedValues,
  declinedValues,
  onRowClick,
}: SheetGridViewProps) {
  const [query, setQuery] = useState("");
  const [highlightApprovals, setHighlightApprovals] = useState(true);
  const [columnFilter, setColumnFilter] = useState<ColumnFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const stageColumns = useMemo(
    () => columns.filter((c) => c.workflowRole === "stage" || c.workflowRole === "overall"),
    [columns],
  );

  const visibleColumns = useMemo(() => {
    if (columnFilter === "form") return columns.filter((c) => c.workflowRole === "form" || c.primary);
    if (columnFilter === "workflow") {
      return columns.filter((c) => c.workflowRole === "stage" || c.workflowRole === "overall" || c.primary);
    }
    return columns;
  }, [columns, columnFilter]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.approvalStatus?.state !== statusFilter) return false;
      if (!q) return true;
      return (
        visibleColumns.some((col) => (row.values[String(col.id)] ?? "").toLowerCase().includes(q)) ||
        String(row.id).includes(q) ||
        (row.approvalStatus?.label ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, visibleColumns, query, statusFilter]);

  const metrics = useMemo(() => {
    let inReview = 0;
    let complete = 0;
    let declined = 0;
    for (const row of rows) {
      const st = row.approvalStatus?.state;
      if (st === "current") inReview++;
      else if (st === "complete") complete++;
      else if (st === "declined") declined++;
    }
    return { total: rows.length, inReview, complete, declined };
  }, [rows]);

  const hasPrimarySticky = visibleColumns.some((c) => c.primary);

  const filterPill = (id: ColumnFilter, label: string) => {
    const active = columnFilter === id;
    return (
      <button
        type="button"
        onClick={() => setColumnFilter(id)}
        className={[
          "rounded-full px-3 py-1 text-xs font-medium transition-colors",
          active
            ? "bg-wsu-crimson text-white"
            : "border border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)]",
        ].join(" ")}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium text-[color:var(--wsu-ink)]">Sheet grid</h1>
          <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
            {demo ? "Demo" : "Live"} · {sheetName} · {rows.length} row{rows.length === 1 ? "" : "s"} × {columns.length}{" "}
            column{columns.length === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href="/forms/manage"
          className="rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)]"
        >
          Manage forms
        </Link>
      </div>

      <div
        className="overflow-hidden rounded-xl border border-[color:var(--wsu-border)] bg-white"
        role="group"
        aria-label="Filter by submission status"
      >
        <div className="grid grid-cols-2 gap-px bg-[color:var(--wsu-border)] sm:grid-cols-4">
          <StatusStat
            label="Total"
            value={metrics.total}
            selected={statusFilter === "all"}
            onSelect={() => setStatusFilter("all")}
          />
          <StatusStat
            label="In review"
            value={metrics.inReview}
            tone="text-amber-700"
            selected={statusFilter === "current"}
            onSelect={() => setStatusFilter("current")}
          />
          <StatusStat
            label="Complete"
            value={metrics.complete}
            tone="text-emerald-700"
            selected={statusFilter === "complete"}
            onSelect={() => setStatusFilter("complete")}
          />
          <StatusStat
            label="Declined"
            value={metrics.declined}
            tone="text-red-700"
            selected={statusFilter === "declined"}
            onSelect={() => setStatusFilter("declined")}
          />
        </div>
        {metrics.total > 0 ? (
          <div className="flex h-1.5 w-full overflow-hidden" aria-hidden>
            {metrics.inReview > 0 ? (
              <div
                className={[
                  "bg-amber-400 transition-[width,opacity] duration-500",
                  statusFilter !== "all" && statusFilter !== "current" ? "opacity-25" : "",
                ].join(" ")}
                style={{ width: `${(metrics.inReview / metrics.total) * 100}%` }}
              />
            ) : null}
            {metrics.complete > 0 ? (
              <div
                className={[
                  "bg-emerald-500 transition-[width,opacity] duration-500",
                  statusFilter !== "all" && statusFilter !== "complete" ? "opacity-25" : "",
                ].join(" ")}
                style={{ width: `${(metrics.complete / metrics.total) * 100}%` }}
              />
            ) : null}
            {metrics.declined > 0 ? (
              <div
                className={[
                  "bg-red-400 transition-[width,opacity] duration-500",
                  statusFilter !== "all" && statusFilter !== "declined" ? "opacity-25" : "",
                ].join(" ")}
                style={{ width: `${(metrics.declined / metrics.total) * 100}%` }}
              />
            ) : null}
            <div className="flex-1 bg-[color:var(--wsu-stone)]" />
          </div>
        ) : (
          <div className="h-1.5 bg-[color:var(--wsu-stone)]" aria-hidden />
        )}
      </div>

      <div className="rounded-xl border border-[color:var(--wsu-border)] bg-white">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[color:var(--wsu-border)] px-4 py-3">
          <div className="relative min-w-[12rem] flex-1 sm:max-w-xs">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wsu-muted)]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search rows or cell values…"
              aria-label="Search grid"
              className="w-full rounded-lg border border-[color:var(--wsu-border)] py-2 pl-9 pr-3 text-sm text-[color:var(--wsu-ink)] placeholder:text-[color:var(--wsu-muted)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {filterPill("all", "All columns")}
            {filterPill("form", "Form")}
            {filterPill("workflow", "Approval")}
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-[color:var(--wsu-muted)]">
            <input
              type="checkbox"
              checked={highlightApprovals}
              onChange={(e) => setHighlightApprovals(e.target.checked)}
              className="h-4 w-4 rounded border-[color:var(--wsu-border)] text-wsu-crimson focus:ring-wsu-crimson"
            />
            Highlight approvals
          </label>
        </div>

        {/* Workflow strip + legend */}
        {(workflow && workflow.approvalStages.length > 0) || stageColumns.length > 0 ? (
          <div className="space-y-3 border-b border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/50 px-4 py-3">
            {workflow && workflow.approvalStages.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-[color:var(--wsu-ink)]">Approval chain</span>
                {workflow.approvalStages.map((name, i) => (
                  <span key={name} className="inline-flex items-center gap-1.5 text-[color:var(--wsu-muted)]">
                    {i > 0 ? <span className="text-[color:var(--wsu-border)]">→</span> : null}
                    <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium text-wsu-crimson ring-1 ring-[color:var(--wsu-border)]">
                      {name}
                    </span>
                  </span>
                ))}
                {workflow.overallColumn ? (
                  <span className="ml-auto text-xs text-[color:var(--wsu-muted)]">Overall: {workflow.overallColumn}</span>
                ) : null}
              </div>
            ) : null}

            {highlightApprovals && stageColumns.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2" aria-label="Approval color legend">
                <span className="text-xs text-[color:var(--wsu-muted)]">Legend</span>
                <LegendChip label="Approved" className="bg-emerald-50 text-emerald-800 ring-emerald-200" />
                <LegendChip label="Declined" className="bg-red-50 text-red-800 ring-red-200" />
                <LegendChip label="In progress" className="bg-amber-50 text-amber-900 ring-amber-200" />
                <LegendChip label="Empty" className="bg-white text-[color:var(--wsu-muted)] ring-[color:var(--wsu-border)]" />
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Table */}
        <div className="relative max-h-[min(70vh,720px)] overflow-auto">
          {filteredRows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-[color:var(--wsu-muted)]">
              {rows.length === 0 ? "No rows on this sheet yet." : "No rows match your search."}
            </p>
          ) : (
            <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 top-0 z-30 w-11 min-w-[2.75rem] border-b border-r border-[color:var(--wsu-border)] bg-[#eef0f4] px-2 py-2.5 text-center text-xs font-medium text-[color:var(--wsu-muted)]"
                  >
                    #
                  </th>
                  <th
                    scope="col"
                    className="sticky left-11 top-0 z-30 min-w-[9.25rem] max-w-[12.5rem] border-b border-r border-[color:var(--wsu-border)] bg-[#eef0f4] px-2 py-2.5 text-left text-xs font-medium text-[color:var(--wsu-muted)]"
                  >
                    Approval
                  </th>
                  {visibleColumns.map((col) => {
                    const isPrimary = col.primary;
                    const stickyPrimary = isPrimary && hasPrimarySticky;
                    const headTone =
                      col.workflowRole === "stage"
                        ? "bg-rose-50/80 text-wsu-crimson"
                        : col.workflowRole === "overall"
                          ? "bg-sky-50/80 text-sky-900"
                          : "bg-[#eef0f4] text-[color:var(--wsu-muted)]";

                    return (
                      <th
                        key={col.id}
                        scope="col"
                        title={col.type}
                        className={[
                          "sticky top-0 z-20 border-b border-r border-[color:var(--wsu-border)] px-3 py-2.5 text-left text-xs font-medium",
                          headTone,
                          stickyPrimary
                            ? "left-48 z-30 min-w-[8.75rem] shadow-[2px_0_4px_rgba(0,0,0,0.04)]"
                            : "min-w-[9rem] max-w-[12rem]",
                        ].join(" ")}
                      >
                        <span className="block truncate" title={col.title}>
                          {col.title}
                        </span>
                        {col.workflowRole === "stage" ? (
                          <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wide opacity-80">Stage</span>
                        ) : col.workflowRole === "overall" ? (
                          <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wide opacity-80">Overall</span>
                        ) : col.primary ? (
                          <span className="mt-0.5 block text-[10px] font-normal uppercase tracking-wide opacity-80">Primary</span>
                        ) : null}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={[
                      "group hover:bg-wsu-crimson/[0.03]",
                      onRowClick ? "cursor-pointer focus-within:bg-wsu-crimson/[0.04]" : "",
                    ].join(" ")}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    aria-label={onRowClick ? `Open submission ${row.approvalStatus?.label ?? row.id}` : undefined}
                  >
                    <td className="sticky left-0 z-10 border-b border-r border-[color:var(--wsu-border)] bg-white px-2 py-2 text-center text-xs text-[color:var(--wsu-muted)] group-hover:bg-[#faf4f5]">
                      {row.rowNumber ?? idx + 1}
                    </td>
                    <td className="sticky left-11 z-10 border-b border-r border-[color:var(--wsu-border)] bg-white px-2 py-2 group-hover:bg-[#faf4f5]">
                      {row.approvalStatus ? (
                        <span
                          className={`inline-block max-w-full truncate rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${approvalBadgeClass(row.approvalStatus.state)}`}
                          title={row.approvalStatus.stage}
                        >
                          {row.approvalStatus.label}
                        </span>
                      ) : (
                        <span className="text-[color:var(--wsu-muted)]">—</span>
                      )}
                    </td>
                    {visibleColumns.map((col) => {
                      const val = row.values[String(col.id)] ?? "";
                      const isWorkflow = col.workflowRole === "stage" || col.workflowRole === "overall";
                      const tone =
                        isWorkflow && highlightApprovals ? approvalTone(val, approvedValues, declinedValues) : null;
                      const stickyPrimary = col.primary && hasPrimarySticky;

                      return (
                        <td
                          key={col.id}
                          title={
                            tone
                              ? `${col.title}: ${val || "empty"} (${approvalToneLabel(tone)})`
                              : `${col.title}${val ? `: ${val}` : ""}`
                          }
                          className={[
                            "border-b border-r border-[color:var(--wsu-border)] px-3 py-2 align-middle",
                            stickyPrimary
                              ? "sticky left-48 z-10 bg-white shadow-[2px_0_4px_rgba(0,0,0,0.04)] group-hover:bg-[#faf4f5]"
                              : "bg-white group-hover:bg-wsu-crimson/[0.02]",
                            toneCellClasses(tone, highlightApprovals && isWorkflow),
                            toneBorderClass(tone, highlightApprovals && isWorkflow),
                            col.primary && !isWorkflow ? "font-medium" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          {val ? (
                            <span className="block max-w-[14rem] truncate">{val}</span>
                          ) : (
                            <span className="text-[color:var(--wsu-muted)]/50">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[color:var(--wsu-border)] px-4 py-2.5 text-xs text-[color:var(--wsu-muted)]">
          Showing {filteredRows.length} of {rows.length} row{rows.length === 1 ? "" : "s"}
          {totalRowCount && totalRowCount > rows.length ? ` (${totalRowCount} total on sheet)` : ""}
          {" · "}
          {visibleColumns.length} of {columns.length} column{columns.length === 1 ? "" : "s"}
          {query ? ` · filtered by “${query}”` : ""}
          {statusFilter !== "all"
            ? ` · status ${statusFilter === "current" ? "in review" : statusFilter}`
            : ""}
          {onRowClick ? " · click a row for submission details" : ""}
        </div>
      </div>
    </div>
  );
}
