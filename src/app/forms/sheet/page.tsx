"use client";

import { useEffect, useMemo, useState } from "react";
import { approvalTone, approvalToneLabel } from "@/lib/forms/approval-style";

interface Column {
  id: number;
  title: string;
  type: string;
  primary?: boolean;
  workflowRole: "stage" | "overall" | "form" | null;
}

interface Row {
  id: number;
  rowNumber?: number;
  createdAt: string | null;
  modifiedAt: string | null;
  values: Record<string, string>;
  approvalStatus?: {
    label: string;
    stage: string;
    value: string;
    state: string;
  } | null;
}

interface WorkflowInfo {
  approvalStages: string[];
  overallColumn: string;
  source: string;
  approvedValues?: string[];
  declinedValues?: string[];
}

function workflowCellClass(
  col: Column,
  value: string,
  approved: string[],
  declined: string[],
): string {
  if (!col.workflowRole || col.workflowRole === "form") {
    return col.primary ? "sheet-cell sheet-cell--primary" : "sheet-cell";
  }
  const tone = approvalTone(value, approved, declined);
  return [
    "sheet-cell",
    `sheet-cell--${col.workflowRole}`,
    `sheet-cell--${tone}`,
    value.trim() ? "sheet-cell--filled" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function SheetViewPage() {
  const [sheetName, setSheetName] = useState("");
  const [columns, setColumns] = useState<Column[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [workflow, setWorkflow] = useState<WorkflowInfo | null>(null);
  const [totalRowCount, setTotalRowCount] = useState<number | null>(null);
  const [demo, setDemo] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [highlightApprovals, setHighlightApprovals] = useState(true);
  const [showFormOnly, setShowFormOnly] = useState(false);
  const [showWorkflowOnly, setShowWorkflowOnly] = useState(false);

  useEffect(() => {
    fetch("/api/forms/sheet-view")
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || d.message || "Could not load sheet.");
        return d;
      })
      .then((d) => {
        setSheetName(d.sheetName);
        setColumns(d.columns ?? []);
        setRows(d.rows ?? []);
        setWorkflow(d.workflow ?? null);
        setTotalRowCount(d.totalRowCount ?? d.rows?.length ?? null);
        setDemo(d.demo);
      })
      .catch((e) => setError(e.message));
  }, []);

  const approved = workflow?.approvedValues ?? [];
  const declined = workflow?.declinedValues ?? [];

  const visibleColumns = useMemo(() => {
    if (showFormOnly) return columns.filter((c) => c.workflowRole === "form" || c.primary);
    if (showWorkflowOnly) return columns.filter((c) => c.workflowRole === "stage" || c.workflowRole === "overall" || c.primary);
    return columns;
  }, [columns, showFormOnly, showWorkflowOnly]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        visibleColumns.some((col) => (row.values[String(col.id)] ?? "").toLowerCase().includes(q)) ||
        String(row.id).includes(q) ||
        (row.approvalStatus?.label ?? "").toLowerCase().includes(q),
    );
  }, [rows, visibleColumns, query]);

  const stageColumns = useMemo(
    () => columns.filter((c) => c.workflowRole === "stage" || c.workflowRole === "overall"),
    [columns],
  );

  const subtitle = sheetName
    ? `${demo ? "Demo" : "Live"} · "${sheetName}" · ${rows.length} row${rows.length === 1 ? "" : "s"} × ${columns.length} column${columns.length === 1 ? "" : "s"}`
    : undefined;

  return (
    <div className="forms-wrap">
      <div className="mb-5">
        <h2 className="forms-page-title">Sheet grid</h2>
        {subtitle ? <p className="forms-page-subtitle">{subtitle}</p> : null}
      </div>

      {error ? (
        <div className="card">
          <div className="note note--err">{error}</div>
        </div>
      ) : !sheetName ? (
        <div className="card">
          <p className="spinner">Loading sheet grid…</p>
        </div>
      ) : (
        <section className="card sheet-grid-card">
          <div className="sheet-grid-head">
            <div>
              <h2>Full sheet table</h2>
              <p className="hint">
                All rows and columns from the active Smartsheet. Approval columns are highlighted when filled —
                green approved, red declined, amber in progress.
              </p>
            </div>
            {workflow && stageColumns.length > 0 ? (
              <div className="sheet-legend" aria-label="Approval color legend">
                <span className="sheet-legend__item sheet-legend__item--approved">Approved</span>
                <span className="sheet-legend__item sheet-legend__item--declined">Declined</span>
                <span className="sheet-legend__item sheet-legend__item--pending">In progress</span>
                <span className="sheet-legend__item sheet-legend__item--empty">Empty</span>
              </div>
            ) : null}
          </div>

          {workflow && workflow.approvalStages.length > 0 ? (
            <div className="sheet-stages">
              <span className="sheet-stages__label">Approval chain:</span>
              {workflow.approvalStages.map((name, i) => (
                <span className="sheet-stages__chip" key={name}>
                  {i > 0 ? <span className="sheet-stages__arrow">→</span> : null}
                  {name}
                </span>
              ))}
              {workflow.overallColumn ? (
                <span className="sheet-stages__overall">Overall: {workflow.overallColumn}</span>
              ) : null}
            </div>
          ) : null}

          <div className="toolbar sheet-toolbar">
            <input
              className="search"
              type="text"
              placeholder="Search rows or cell values…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="check sheet-toggle">
              <input
                type="checkbox"
                checked={highlightApprovals}
                onChange={(e) => setHighlightApprovals(e.target.checked)}
              />
              Highlight approvals
            </label>
            <label className="check sheet-toggle">
              <input
                type="checkbox"
                checked={showFormOnly}
                onChange={(e) => {
                  setShowFormOnly(e.target.checked);
                  if (e.target.checked) setShowWorkflowOnly(false);
                }}
              />
              Form columns
            </label>
            <label className="check sheet-toggle">
              <input
                type="checkbox"
                checked={showWorkflowOnly}
                onChange={(e) => {
                  setShowWorkflowOnly(e.target.checked);
                  if (e.target.checked) setShowFormOnly(false);
                }}
              />
              Approval columns
            </label>
          </div>

          <div className="sheet-grid-wrap">
            {filteredRows.length === 0 ? (
              <p className="empty">{rows.length === 0 ? "No rows on this sheet yet." : "No rows match your search."}</p>
            ) : (
              <table className="sheet-grid">
                <thead>
                  <tr>
                    <th className="sheet-grid__sticky sheet-grid__rownum">#</th>
                    <th className="sheet-grid__sticky sheet-grid__approval-col">Approval</th>
                    {visibleColumns.map((col) => (
                      <th
                        key={col.id}
                        className={[
                          col.primary ? "sheet-grid__sticky sheet-grid__primary-col" : "",
                          col.workflowRole === "stage" ? "sheet-grid__stage-head" : "",
                          col.workflowRole === "overall" ? "sheet-grid__overall-head" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        title={col.type}
                      >
                        <span className="sheet-grid__col-title">{col.title}</span>
                        {col.workflowRole === "stage" ? (
                          <span className="sheet-grid__col-tag">Stage</span>
                        ) : col.workflowRole === "overall" ? (
                          <span className="sheet-grid__col-tag">Overall</span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, idx) => (
                    <tr key={row.id}>
                      <td className="sheet-grid__sticky sheet-grid__rownum muted">
                        {row.rowNumber ?? idx + 1}
                      </td>
                      <td className="sheet-grid__sticky sheet-grid__approval-col">
                        {row.approvalStatus ? (
                          <span
                            className={`badge badge--sm ${
                              row.approvalStatus.state === "complete"
                                ? "badge--ok"
                                : row.approvalStatus.state === "declined"
                                  ? "badge--err"
                                  : "badge--neutral"
                            }`}
                            title={row.approvalStatus.stage}
                          >
                            {row.approvalStatus.label}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      {visibleColumns.map((col) => {
                        const val = row.values[String(col.id)] ?? "";
                        const isWorkflow = col.workflowRole === "stage" || col.workflowRole === "overall";
                        const tone = isWorkflow && highlightApprovals ? approvalTone(val, approved, declined) : null;
                        const stickyPrimary = col.primary ? "sheet-grid__sticky sheet-grid__primary-col" : "";
                        return (
                          <td
                            key={col.id}
                            className={[
                              stickyPrimary,
                              highlightApprovals && isWorkflow
                                ? workflowCellClass(col, val, approved, declined)
                                : col.primary
                                  ? "sheet-cell sheet-cell--primary"
                                  : "sheet-cell",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            title={tone ? `${col.title}: ${val || "empty"} (${approvalToneLabel(tone)})` : col.title}
                          >
                            {val ? (
                              <span className="sheet-cell__value">{val}</span>
                            ) : (
                              <span className="sheet-cell__empty">—</span>
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

          <p className="hint sheet-grid-foot">
            Showing {filteredRows.length} of {rows.length} row{rows.length === 1 ? "" : "s"}
            {totalRowCount && totalRowCount > rows.length ? ` (${totalRowCount} total on sheet)` : ""}
            {" · "}
            {visibleColumns.length} of {columns.length} column{columns.length === 1 ? "" : "s"}
            {query ? ` · filtered by “${query}”` : ""}. Card view: <a href="/forms/tracker">Tracker</a>.
          </p>
        </section>
      )}
    </div>
  );
}
