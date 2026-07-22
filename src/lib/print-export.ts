import printDefaults from "@/config/print-export-defaults.json";

export type PrintExportConfig = typeof printDefaults;

/** Print page table layout: chunked PDF sections vs one sideways-scrolling table. */
export type PrintTableLayout = "sections" | "wide";

/** Editable defaults: `src/config/print-export-defaults.json` */
export function getPrintExportConfig(): PrintExportConfig {
  return printDefaults;
}

/**
 * CSS for `/view/.../print`: variables come from `.print-export` (JSON → `--print-*`).
 * Typography is scoped under `.print-export` so it does not rely on theme tokens that blow up in PDF.
 */
export function buildPrintExportStylesheet(config: PrintExportConfig): string {
  const { page, masthead, table } = config;
  return `
  .print-export {
    --print-masthead-source: ${masthead.sourceLabelFontSize};
    --print-masthead-title: ${masthead.titleFontSize};
    --print-masthead-title-weight: ${masthead.titleFontWeight};
    --print-masthead-title-lh: ${masthead.titleLineHeight};
    --print-masthead-meta: ${masthead.metaFontSize};
    --print-masthead-subtitle: ${masthead.subtitleFontSize};
    --print-masthead-border: ${masthead.borderBottom};
    --print-masthead-pb: ${masthead.paddingBottom};
    --print-masthead-mb: ${masthead.marginBottom};
    --print-table-font: ${table.fontFamily};
    --print-caption-size: ${table.captionFontSize};
    --print-caption-weight: ${table.captionFontWeight};
    --print-th-size: ${table.headerFontSize};
    --print-th-weight: ${table.headerFontWeight};
    --print-th-ls: ${table.headerLetterSpacing};
    --print-th-transform: ${table.headerTextTransform};
    --print-th-bg: ${table.headerBg};
    --print-th-border-b: ${table.headerBorderBottom};
    --print-td-size: ${table.cellFontSize};
    --print-td-lh: ${table.cellLineHeight};
    --print-td-weight: ${table.cellFontWeight};
    --print-td-primary-weight: ${table.primaryColumnFontWeight};
    --print-td-padding: ${table.cellPadding};
    --print-td-minw: ${table.minCellWidth};
    --print-td-maxw: ${table.maxCellWidth};
    --print-td-border-b: ${table.bodyBorderBottom};
    --print-td-border-r: ${table.gridBorderRight};
    --print-ink: ${table.textColor};
    --print-muted: ${table.mutedTextColor};
  }

  @page {
    size: ${page.size};
    margin: ${page.margin};
  }

  /* Screen + print: masthead scale (independent of theme page-title tokens) */
  .print-export.print-root {
    color: var(--print-ink);
    font-family: var(--print-table-font);
    font-size: var(--print-td-size);
    line-height: var(--print-td-lh);
  }
  .print-export .print-masthead {
    border-bottom: var(--print-masthead-border);
    padding-bottom: var(--print-masthead-pb);
    margin-bottom: var(--print-masthead-mb);
  }
  .print-export .print-masthead .view-header-source-label {
    font-size: var(--print-masthead-source) !important;
    letter-spacing: 0.08em !important;
    line-height: 1.2 !important;
    color: var(--print-ink) !important;
  }
  .print-export .print-masthead .view-header-page-title {
    font-size: var(--print-masthead-title) !important;
    font-weight: var(--print-masthead-title-weight) !important;
    line-height: var(--print-masthead-title-lh) !important;
    margin-top: 0.25rem !important;
    color: var(--print-ink) !important;
  }
  .print-export .print-masthead .print-masthead-meta {
    font-size: var(--print-masthead-meta) !important;
    color: var(--print-muted) !important;
  }
  .print-export .print-masthead .print-masthead-subtitle {
    font-size: var(--print-masthead-subtitle) !important;
    line-height: 1.35 !important;
    color: var(--print-muted) !important;
  }

  /* Screen + print: natural table width — avoid forcing 100% (browsers shrink wide tables when printing) */
  .print-export .print-data-table {
    width: auto;
    max-width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-family: var(--print-table-font) !important;
    font-size: var(--print-td-size) !important;
    line-height: var(--print-td-lh) !important;
    table-layout: auto;
    color: var(--print-ink) !important;
  }
  /* Full-table preview: keep column widths and scroll sideways on screen */
  .print-export.print-export--wide .print-table-wrap {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .print-export.print-export--wide .print-data-table {
    max-width: none;
    width: max-content;
    min-width: 100%;
  }
  .print-export .print-data-table caption {
    text-align: left;
    font-size: var(--print-caption-size) !important;
    font-weight: var(--print-caption-weight) !important;
    color: var(--print-muted) !important;
    padding: 0 0 0.5rem 0;
  }
  .print-export .print-data-table th[scope="col"] {
    text-align: left;
    font-weight: var(--print-th-weight) !important;
    letter-spacing: var(--print-th-ls) !important;
    text-transform: var(--print-th-transform) !important;
    font-size: var(--print-th-size) !important;
    border: none;
    border-bottom: var(--print-th-border-b);
    border-right: var(--print-td-border-r);
    background: var(--print-th-bg) !important;
    padding: var(--print-td-padding) !important;
    vertical-align: bottom;
    color: var(--print-ink) !important;
    min-width: var(--print-td-minw);
    max-width: var(--print-td-maxw);
    white-space: normal;
    hyphens: manual;
  }
  .print-export .print-data-table thead th:last-child {
    border-right: none !important;
  }
  .print-export .print-data-table th[scope="row"] {
    text-align: left;
    font-weight: var(--print-td-primary-weight) !important;
    font-size: var(--print-td-size) !important;
    line-height: var(--print-td-lh) !important;
    border: none;
    border-bottom: var(--print-td-border-b);
    border-right: var(--print-td-border-r);
    background: #fff !important;
    padding: var(--print-td-padding) !important;
    vertical-align: top;
    min-width: var(--print-td-minw);
    max-width: var(--print-td-maxw);
    color: var(--print-ink) !important;
  }
  .print-export .print-data-table tbody td {
    border: none;
    border-bottom: var(--print-td-border-b);
    border-right: var(--print-td-border-r);
    background: #fff !important;
    padding: var(--print-td-padding) !important;
    vertical-align: top;
    min-width: var(--print-td-minw);
    max-width: var(--print-td-maxw);
    font-size: var(--print-td-size) !important;
    font-weight: var(--print-td-weight) !important;
    line-height: var(--print-td-lh) !important;
    color: var(--print-ink) !important;
    /* Prefer natural word breaks — avoid letter-by-letter stacking in narrow columns */
    overflow-wrap: break-word;
    word-break: normal;
    hyphens: manual;
  }
  .print-export .print-data-table tbody td:last-child {
    border-right: none !important;
  }
  .print-export .print-data-table tbody th[scope="row"] {
    overflow-wrap: break-word;
    word-break: normal;
  }
  .print-export .print-data-table .print-cell-inner {
    max-width: 100%;
  }
  /* Badges / pills should not crush to a single character width */
  .print-export .print-data-table .print-cell-inner .inline-flex,
  .print-export .print-data-table .print-cell-inner [class*="rounded-full"] {
    max-width: 100%;
    white-space: normal;
    height: auto;
    text-align: left;
  }

  /* Reset FieldValue / theme inside cells (program, campus, people blocks, etc.) */
  .print-export .print-data-table .print-cell-inner,
  .print-export .print-data-table .print-cell-inner * {
    font-family: var(--print-table-font) !important;
    font-size: var(--print-td-size) !important;
    line-height: var(--print-td-lh) !important;
    font-style: normal !important;
    letter-spacing: 0 !important;
    text-transform: none !important;
  }
  .print-export .print-data-table .print-cell-inner,
  .print-export .print-data-table .print-cell-inner *:not(a) {
    font-weight: var(--print-td-weight) !important;
    color: var(--print-ink) !important;
  }
  .print-export .print-data-table .print-cell-inner--primary,
  .print-export .print-data-table .print-cell-inner--primary *:not(a) {
    font-weight: var(--print-td-primary-weight) !important;
  }
  .print-export .print-data-table ul,
  .print-export .print-data-table ol {
    margin: 0 !important;
    padding-left: 1em !important;
  }
  .print-export .print-data-table li {
    margin: 0 !important;
  }
  /* PDF / print: data cells are reference-only, not interactive links */
  .print-export .print-data-table a:link,
  .print-export .print-data-table a:visited {
    color: inherit !important;
    text-decoration: none !important;
    pointer-events: none;
    cursor: default;
  }
  .print-export .print-empty-cell {
    color: var(--print-muted) !important;
    font-weight: 400 !important;
  }

  @media print {
    .no-print { display: none !important; }
    html, body {
      background: white !important;
      overflow: visible !important;
      /* economy: let the browser strip decorative fills; we rely on explicit white overrides below */
      -webkit-print-color-adjust: economy;
      print-color-adjust: economy;
    }
    .print-export.print-root {
      max-width: none !important;
      width: 100% !important;
      padding: 0 !important;
      overflow: visible !important;
    }
    .print-export .print-table-wrap {
      overflow: visible !important;
      border-radius: 0 !important;
      border: none !important;
      background: transparent !important;
      padding: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
    }
    .print-export .print-data-table {
      border: none !important;
      width: auto !important;
      max-width: none !important;
    }
    .print-export .print-column-chunk {
      break-before: page;
      page-break-before: always;
    }
    .print-export .print-column-chunk:first-child {
      break-before: auto;
      page-break-before: auto;
    }
    .print-export .print-data-table thead {
      display: table-header-group;
    }
    /* No fill on column headers in print: rely solely on the bottom border */
    .print-export .print-data-table th[scope="col"] {
      background: white !important;
    }
    .print-export .print-data-table th[scope="col"],
    .print-export .print-data-table th[scope="row"],
    .print-export .print-data-table tbody td {
      break-inside: avoid;
      page-break-inside: avoid;
    }
  }
`;
}
