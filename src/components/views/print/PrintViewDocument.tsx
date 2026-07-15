import type { ReactNode } from "react";
import { CampusBadgeStyleProvider } from "@/components/views/shared/CampusBadgeStyleContext";
import { FieldValue } from "@/components/views/layouts/FieldValue";
import { getRowHeadingField } from "@/components/views/layouts/layout-utils";
import { ViewStyleWrapper } from "@/components/views/shell/ViewStyleWrapper";
import { formatFetchedAtInViewTimeZone } from "@/lib/display-datetime";
import type { ResolvedFieldValue, ResolvedView, ResolvedViewRow } from "@/lib/config/types";
import { buildPrintExportStylesheet, getPrintExportConfig } from "@/lib/print-export";
import { PrintViewToolbar } from "./PrintViewToolbar";

function PrintCellInner({ primary, children }: { primary?: boolean; children: ReactNode }) {
  return (
    <div className={primary ? "print-cell-inner print-cell-inner--primary" : "print-cell-inner"}>
      {children}
    </div>
  );
}

type PrintableColumn = {
  key: string;
  label: string;
  heading?: boolean;
};

function canPrintField(field: ResolvedFieldValue | undefined) {
  return Boolean(field && !(field.hideWhenEmpty && field.isEmpty));
}

function getPrintableColumns(view: ResolvedView, selectedKeys?: string[]): PrintableColumn[] {
  const firstHeading = view.rows.map((row) => getRowHeadingField(view, row)).find(Boolean);
  const headingKey = view.presentation?.headingFieldKey ?? firstHeading?.key ?? null;
  const headingLabel =
    (headingKey && view.fields.find((field) => field.key === headingKey)?.label) || firstHeading?.label || "Record";

  const columns: PrintableColumn[] = [];
  const seen = new Set<string>();

  if (headingKey) {
    columns.push({ key: headingKey, label: headingLabel, heading: true });
    seen.add(headingKey);
  }

  for (const field of view.fields) {
    if (field.renderType === "hidden" || seen.has(field.key)) {
      continue;
    }
    const hasAnyValue = view.rows.some((row) => canPrintField(row.fieldMap[field.key]));
    if (hasAnyValue) {
      columns.push({ key: field.key, label: field.label || field.key });
    }
  }

  if (selectedKeys && selectedKeys.length > 0) {
    const allow = new Set(selectedKeys);
    return columns.filter((c) => c.heading || allow.has(c.key));
  }

  return columns;
}

/** Keys and labels for the print page column picker (includes heading row). */
export function buildPrintColumnPickerOptions(
  view: ResolvedView,
): Array<{ key: string; label: string; heading?: boolean }> {
  return getPrintableColumns(view);
}

function bucketPrintRowGroups(view: ResolvedView, groupByKey: string | undefined): ResolvedViewRow[][] {
  if (!groupByKey || !view.fields.some((f) => f.key === groupByKey)) {
    return [view.rows];
  }
  const map = new Map<string, ResolvedViewRow[]>();
  for (const row of view.rows) {
    const f = row.fieldMap[groupByKey];
    const label =
      f?.textValue?.trim() ||
      (f?.listValue && f.listValue.length > 0 ? f.listValue.join("; ") : "") ||
      "—";
    const k = label.toLowerCase();
    if (!map.has(k)) {
      map.set(k, []);
    }
    map.get(k)!.push(row);
  }
  const groups = [...map.values()];
  const sortLabel = (row: ResolvedViewRow) => {
    const ff = row.fieldMap[groupByKey];
    return (
      ff?.textValue?.trim() ||
      (ff?.listValue && ff.listValue.length > 0 ? ff.listValue.join("; ") : "") ||
      ""
    );
  };
  groups.sort((a, b) => sortLabel(a[0]!).localeCompare(sortLabel(b[0]!), undefined, { sensitivity: "base" }));
  return groups;
}

function PrintDataTableSection({
  columns,
  groupRows,
  caption,
  tableBorderRadius,
}: {
  columns: PrintableColumn[];
  groupRows: ResolvedViewRow[];
  caption: string;
  tableBorderRadius: string;
}) {
  return (
    <div
      className="print-table-wrap overflow-x-auto border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)]"
      style={{ borderRadius: tableBorderRadius }}
    >
      <table className="print-data-table min-w-full border-separate border-spacing-0 text-left">
        <caption>
          {caption}
        </caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className="whitespace-normal">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupRows.map((row) => (
            <tr key={row.id} className="align-top">
              {columns.map((column) => {
                if (column.heading) {
                  const headingField = row.fieldMap[column.key];
                  return (
                    <th key={`${row.id}-${column.key}`} scope="row">
                      {headingField && canPrintField(headingField) ? (
                        <PrintCellInner primary>
                          <FieldValue field={headingField} plainValueLinks />
                        </PrintCellInner>
                      ) : (
                        <>
                          <span className="print-empty-cell" aria-hidden="true">—</span>
                          <span className="sr-only">Empty</span>
                        </>
                      )}
                    </th>
                  );
                }

                const field = row.fieldMap[column.key];
                return (
                  <td key={`${row.id}-${column.key}`}>
                    {canPrintField(field) ? (
                      <PrintCellInner>
                        <FieldValue field={field!} plainValueLinks />
                      </PrintCellInner>
                    ) : (
                      <>
                        <span className="print-empty-cell" aria-hidden="true">—</span>
                        <span className="sr-only">Empty</span>
                      </>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PrintViewDocument({
  slug,
  viewId,
  singlePublishedView,
  pageTitle,
  sourceLabel,
  sourceName,
  fetchedAt,
  view,
  printColumnKeys,
  printCompact,
  printableColumnOptions,
}: {
  slug: string;
  viewId: string;
  singlePublishedView: boolean;
  pageTitle: string;
  sourceLabel: string;
  sourceName: string;
  fetchedAt: string;
  view: ResolvedView;
  /** When set, only these column keys (plus heading) are printed. */
  printColumnKeys?: string[];
  /** Smaller type for dense PDFs */
  printCompact?: boolean;
  /** All selectable columns for the print UI (non-hidden fields that appear in default print). */
  printableColumnOptions?: Array<{ key: string; label: string; heading?: boolean }>;
}) {
  const printConfig = getPrintExportConfig();
  const printStyles = buildPrintExportStylesheet(printConfig);
  const preview = printConfig.screenPreview;
  const refreshedPrinted = formatFetchedAtInViewTimeZone(fetchedAt, view.displayTimeZone);
  const columns = getPrintableColumns(view, printColumnKeys);
  const groupByKey = view.presentation?.printGroupByFieldKey;
  const rowGroups = bucketPrintRowGroups(view, groupByKey);
  const groupFieldLabel = groupByKey
    ? view.fields.find((f) => f.key === groupByKey)?.label ?? groupByKey
    : null;

  return (
    <ViewStyleWrapper style={view.style} themePresetId={view.themePresetId}>
      <CampusBadgeStyleProvider style={view.presentation?.campusBadgeStyle}>
      <style dangerouslySetInnerHTML={{ __html: printStyles }} />
      {printCompact ? (
        <style
          dangerouslySetInnerHTML={{
            __html: `
          .print-export.print-root.print-export--compact {
            --print-masthead-title: 1.125rem;
            --print-masthead-meta: 0.6875rem;
            --print-masthead-subtitle: 0.8125rem;
            --print-th-size: 0.65rem;
            --print-td-size: 0.6875rem;
            --print-td-lh: 1.35;
            --print-td-padding: 0.35rem 0.45rem;
          }
        `,
          }}
        />
      ) : null}
      <main
        className={`print-export print-root mx-auto px-3 py-6 sm:px-4 sm:py-8${printCompact ? " print-export--compact" : ""}`}
        style={{ maxWidth: preview.rootMaxWidth }}
        lang="en"
      >
        <PrintViewToolbar
          slug={slug}
          viewId={viewId}
          singlePublishedView={singlePublishedView}
          columnOptions={printableColumnOptions}
          compact={printCompact}
        />

        <header className="print-masthead mb-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6">
            <div className="min-w-0">
              <p className="view-header-source-label">{sourceLabel}</p>
              <h1 className="view-header-page-title mt-1 text-balance">{pageTitle}</h1>
            </div>
            <p className="print-masthead-meta shrink-0">
              <span className="font-medium" style={{ color: "var(--print-ink)" }}>
                Source:
              </span>{" "}
              {sourceName}
              <span className="mx-1.5 opacity-60">|</span>
              <span className="font-medium" style={{ color: "var(--print-ink)" }}>
                Printed
              </span>{" "}
              <time dateTime={fetchedAt} className="tabular-nums">
                {refreshedPrinted}
              </time>
            </p>
          </div>
          {(view.label !== pageTitle || view.description) && (
            <p className="print-masthead-subtitle mt-2 max-w-[70ch]">
              <span className="font-medium" style={{ color: "var(--print-ink)" }}>
                {view.label}
              </span>
              {view.description ? ` — ${view.description}` : null}
            </p>
          )}
        </header>

        {view.rows.length > 0 ? (
          <div className="space-y-10">
            {rowGroups.map((groupRows, gi) => {
              const groupTitle =
                groupByKey && groupRows[0]?.fieldMap[groupByKey]
                  ? groupRows[0]!.fieldMap[groupByKey]!.textValue?.trim() ||
                    (groupRows[0]!.fieldMap[groupByKey]!.listValue?.length
                      ? groupRows[0]!.fieldMap[groupByKey]!.listValue.join("; ")
                      : "—")
                  : null;
              const baseCaption = `${pageTitle}${view.label !== pageTitle ? ` · ${view.label}` : ""} (${view.rows.length} row${view.rows.length === 1 ? "" : "s"} total)`;
              const caption =
                rowGroups.length > 1
                  ? `${baseCaption} — ${groupFieldLabel ?? "Group"}: ${groupTitle ?? gi + 1} (${groupRows.length} row${groupRows.length === 1 ? "" : "s"})`
                  : baseCaption;

              return (
                <section key={gi} className="print-group">
                  {rowGroups.length > 1 && groupFieldLabel && groupTitle != null ? (
                    <h2
                      className="mb-3 text-base font-semibold tracking-tight sm:text-lg"
                      style={{ color: "var(--print-ink)" }}
                    >
                      {groupFieldLabel}: {groupTitle}{" "}
                      <span style={{ color: "var(--print-muted)", fontWeight: 400 }}>
                        ({groupRows.length} row{groupRows.length === 1 ? "" : "s"})
                      </span>
                    </h2>
                  ) : null}
                  <PrintDataTableSection
                    columns={columns}
                    groupRows={groupRows}
                    caption={caption}
                    tableBorderRadius={preview.tableBorderRadius}
                  />
                </section>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-[color:var(--wsu-muted)]">No rows to display for this view.</p>
        )}
      </main>
      </CampusBadgeStyleProvider>
    </ViewStyleWrapper>
  );
}
