/**
 * Parse Excel/CSV uploads into Smartsheet column defs + row values for form creation.
 */

import type {
  ExcelEditableType,
  ExcelImportColumn,
  ExcelImportOverride,
  ExcelImportPreview,
  ExcelInferredType,
} from "@/lib/forms/excel-import-types";

export type {
  ExcelEditableType,
  ExcelImportColumn,
  ExcelImportOverride,
  ExcelImportPreview,
  ExcelInferredType,
} from "@/lib/forms/excel-import-types";

export const EXCEL_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const EXCEL_IMPORT_MAX_COLUMNS = 200;
export const EXCEL_IMPORT_MAX_ROWS = 5000;
export const SMARTSHEET_TITLE_MAX = 50;

export interface ExcelParsedWorkbook {
  preview: ExcelImportPreview;
  /** Parallel to preview.columns: cell values for each data row. */
  columnValues: unknown[][];
  /** Parallel to preview.columns: Excel formula strings per data row. */
  columnFormulas: (string | undefined)[][];
  /** Excel 1-based row numbers for each data row. */
  dataRowNumbers: number[];
}

function colLetterToIndex(letters: string): number {
  let n = 0;
  const upper = letters.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    n = n * 26 + (upper.charCodeAt(i) - 64);
  }
  return n - 1;
}

function indexToColLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Normalize a header into a Smartsheet-safe unique title. */
export function uniquifyTitles(rawTitles: string[]): string[] {
  const used = new Set<string>();
  return rawTitles.map((raw, i) => {
    let base = String(raw ?? "")
      .replace(/[\r\n\t]+/g, " ")
      .trim()
      .slice(0, SMARTSHEET_TITLE_MAX);
    if (!base) base = `Column ${i + 1}`;
    let candidate = base;
    let n = 2;
    while (used.has(candidate.toLowerCase())) {
      const suffix = ` (${n})`;
      candidate = `${base.slice(0, Math.max(1, SMARTSHEET_TITLE_MAX - suffix.length))}${suffix}`;
      n++;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  });
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  return false;
}

function cellDisplayString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text?: unknown }).text ?? "");
  }
  if (typeof value === "object" && value !== null && "result" in value) {
    return cellDisplayString((value as { result?: unknown }).result);
  }
  return String(value).trim();
}

function looksLikePhone(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return false;
  return /^[+]?[\d\s().-]{7,}$/.test(s.trim());
}

function looksLikeCheckbox(s: string): boolean {
  const t = s.trim().toLowerCase();
  return ["true", "false", "yes", "no", "y", "n", "1", "0", "checked", "unchecked"].includes(t);
}

function parseCheckbox(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return null;
  }
  const t = cellDisplayString(value).toLowerCase();
  if (["true", "yes", "y", "1", "checked"].includes(t)) return true;
  if (["false", "no", "n", "0", "unchecked"].includes(t)) return false;
  return null;
}

function isDateValue(value: unknown): boolean {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return true;
  if (typeof value === "string") {
    const t = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return !Number.isNaN(Date.parse(t));
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(t)) return !Number.isNaN(Date.parse(t));
  }
  return false;
}

/** Infer Smartsheet column type from sample cell values. */
export function inferColumnType(values: unknown[]): {
  type: ExcelInferredType;
  options?: string[];
} {
  const nonBlank = values.filter((v) => !isBlank(v));
  if (!nonBlank.length) return { type: "TEXT_NUMBER" };

  const dateCount = nonBlank.filter((v) => isDateValue(v)).length;
  if (dateCount / nonBlank.length >= 0.8) return { type: "DATE" };

  const boolCount = nonBlank.filter((v) => {
    if (typeof v === "boolean") return true;
    return looksLikeCheckbox(cellDisplayString(v));
  }).length;
  if (boolCount / nonBlank.length >= 0.8) return { type: "CHECKBOX" };

  const strings = nonBlank.map((v) => cellDisplayString(v)).filter(Boolean);
  const phoneCount = strings.filter(looksLikePhone).length;
  if (phoneCount / Math.max(strings.length, 1) >= 0.8 && strings.length >= 2) {
    return { type: "PHONE" };
  }

  const unique = [...new Set(strings.map((s) => s.trim()).filter(Boolean))];
  const uniquenessRatio = unique.length / Math.max(strings.length, 1);
  // Prefer picklist when values repeat across a small option set (not free-form unique text).
  if (
    unique.length >= 2 &&
    unique.length <= 15 &&
    uniquenessRatio <= 0.75 &&
    strings.every((s) => s.length <= 80)
  ) {
    return { type: "PICKLIST", options: unique.slice(0, 100) };
  }

  return { type: "TEXT_NUMBER" };
}

/**
 * Strip absolute row numbers from same-row A1 refs so patterns can be compared across rows.
 * Example: `=B2*C2` with row 2 → `=B{ROW}*C{ROW}`
 */
export function normalizeFormulaPattern(formula: string, rowNumber: number): string | null {
  const f = formula.trim().replace(/^=/, "");
  if (!f) return null;
  return f.replace(/(\$?)([A-Za-z]{1,3})(\$?)(\d+)/g, (match, absCol, letters, absRow, row) => {
    if (absCol === "$" || absRow === "$") return match;
    if (Number(row) === rowNumber) return `${letters}{ROW}`;
    return match;
  });
}

const UNSAFE_FORMULA_RE =
  /\b(VLOOKUP|HLOOKUP|XLOOKUP|INDEX|MATCH|INDIRECT|OFFSET|GETPIVOTDATA|HYPERLINK)\b|!|'[^']+'/i;

/**
 * Convert a same-row Excel formula into a Smartsheet column formula.
 * Supports basic operators and IF / SUM when all refs are same-row relative.
 */
export function convertExcelFormulaToSmartsheet(
  formula: string,
  rowNumber: number,
  columnTitlesByIndex: Map<number, string>,
): string | null {
  const raw = formula.trim().replace(/^=/, "");
  if (!raw) return null;
  if (UNSAFE_FORMULA_RE.test(raw)) return null;
  if (/\$[A-Za-z]{1,3}|[A-Za-z]{1,3}\$\d+/.test(raw)) return null;

  let failed = false;
  const converted = raw.replace(/([A-Za-z]{1,3})(\d+)/g, (match, letters: string, row: string) => {
    if (Number(row) !== rowNumber) {
      failed = true;
      return match;
    }
    const idx = colLetterToIndex(letters);
    const title = columnTitlesByIndex.get(idx);
    if (!title) {
      failed = true;
      return match;
    }
    return `[${title}]@row`;
  });

  if (failed) return null;

  const cleaned = converted.replace(/\[[^\]]+\]@row/g, "X");
  if (!/^[A-Za-z0-9_+\-*/()<>=&.,\s"]+$/i.test(cleaned)) return null;
  if (/\b(VLOOKUP|HLOOKUP|XLOOKUP|INDEX|MATCH|INDIRECT|OFFSET)\b/i.test(cleaned)) return null;

  return `=${converted}`;
}

function majorityFormulaPattern(
  formulas: (string | undefined)[],
  dataRowNumbers: number[],
): { pattern: string; sampleFormula: string; sampleRow: number } | null {
  const counts = new Map<string, { count: number; sample: string; row: number }>();
  let withFormula = 0;
  for (let i = 0; i < formulas.length; i++) {
    const f = formulas[i];
    if (!f) continue;
    withFormula++;
    const rowNum = dataRowNumbers[i];
    if (rowNum == null) continue;
    const pattern = normalizeFormulaPattern(f, rowNum);
    if (!pattern) continue;
    const prev = counts.get(pattern);
    if (prev) prev.count++;
    else counts.set(pattern, { count: 1, sample: f, row: rowNum });
  }
  if (withFormula === 0) return null;
  let best: { pattern: string; sample: string; row: number; count: number } | null = null;
  for (const [pattern, info] of Array.from(counts.entries())) {
    if (!best || info.count > best.count) {
      best = { pattern, sample: info.sample, row: info.row, count: info.count };
    }
  }
  if (!best) return null;
  if (best.count / withFormula < 0.6) return null;
  return { pattern: best.pattern, sampleFormula: best.sample, sampleRow: best.row };
}

type ExcelCellLike = {
  formula?: string;
  value?: unknown;
};

function extractCellFormula(cell: ExcelCellLike): string | undefined {
  const f = cell.formula;
  if (typeof f === "string" && f.trim()) return f.trim().replace(/^=/, "");
  const value = cell.value;
  if (value && typeof value === "object" && "formula" in value) {
    const ff = (value as { formula?: string }).formula;
    if (typeof ff === "string" && ff.trim()) return ff.trim().replace(/^=/, "");
  }
  return undefined;
}

function extractCellValue(cell: ExcelCellLike): unknown {
  const value = cell.value;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if ("result" in value) return (value as { result?: unknown }).result ?? null;
    if ("text" in value) return (value as { text?: unknown }).text ?? null;
    if ("richText" in value) {
      const parts = (value as { richText?: { text?: string }[] }).richText ?? [];
      return parts.map((p) => p.text ?? "").join("");
    }
    if ("formula" in value) return (value as { result?: unknown }).result ?? null;
  }
  return value ?? null;
}

function parseCsvToMatrix(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function assignPrimary(columns: ExcelImportColumn[]): void {
  let primarySet = false;
  for (const col of columns) {
    col.primary = false;
    if (!col.included) continue;
    if (col.smartsheetFormula) continue;
    if (!primarySet) {
      col.primary = true;
      primarySet = true;
    }
  }
  if (!primarySet) {
    const first = columns.find((c) => c.included);
    if (first) {
      first.primary = true;
      if (first.smartsheetFormula) {
        first.smartsheetFormula = undefined;
        first.formulaNote =
          "Primary column cannot use a formula — values will be imported as static data.";
      }
    }
  }
}

function resolveFormulaNotes(
  columns: ExcelImportColumn[],
  columnFormulas: (string | undefined)[][],
  dataRowNumbers: number[],
): void {
  const titleByWsIndex = new Map(columns.map((c) => [c.sourceIndex, c.title]));

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i]!;
    if (!col.hasExcelFormula) {
      col.smartsheetFormula = undefined;
      col.formulaNote = undefined;
      continue;
    }
    const majority = majorityFormulaPattern(columnFormulas[i] ?? [], dataRowNumbers);
    if (!majority) {
      col.smartsheetFormula = undefined;
      col.formulaNote =
        "Excel formula detected; pattern is mixed or unsupported — values will be imported as static data.";
      continue;
    }
    const sample = majority.sampleFormula.startsWith("=")
      ? majority.sampleFormula
      : `=${majority.sampleFormula}`;
    const converted = convertExcelFormulaToSmartsheet(sample, majority.sampleRow, titleByWsIndex);
    if (converted) {
      col.smartsheetFormula = converted;
      col.formulaNote = `Will set Smartsheet formula: ${converted}`;
    } else {
      col.smartsheetFormula = undefined;
      col.formulaNote =
        "Excel formula detected but could not be converted — values will be imported as static data.";
    }
  }
}

function buildParsedWorkbook(input: {
  sheetName: string;
  worksheetColIndices: number[];
  titles: string[];
  values: unknown[][];
  formulas: (string | undefined)[][];
  dataRowNumbers: number[];
}): ExcelParsedWorkbook {
  const columns: ExcelImportColumn[] = input.titles.map((title, i) => {
    const colValues = input.values[i] ?? [];
    const colFormulas = input.formulas[i] ?? [];
    const inferred = inferColumnType(colValues);
    const hasExcelFormula = colFormulas.some(Boolean);
    const samples = colValues
      .map(cellDisplayString)
      .filter((s) => s.trim())
      .slice(0, 3);

    return {
      sourceIndex: input.worksheetColIndices[i] ?? i,
      title,
      type: inferred.type,
      options: inferred.options,
      hasExcelFormula,
      sampleValues: samples,
      included: true,
    };
  });

  resolveFormulaNotes(columns, input.formulas, input.dataRowNumbers);
  assignPrimary(columns);

  return {
    preview: {
      columns,
      rowCount: input.dataRowNumbers.length,
      sheetName: input.sheetName,
    },
    columnValues: input.values,
    columnFormulas: input.formulas,
    dataRowNumbers: input.dataRowNumbers,
  };
}

function parseCsvBuffer(buffer: Buffer): ExcelParsedWorkbook {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const matrix = parseCsvToMatrix(text);
  if (!matrix.length) throw new Error("The CSV file is empty.");

  const headerRow = matrix[0]!;
  const worksheetColIndices: number[] = [];
  const rawHeaders: string[] = [];
  for (let c = 0; c < headerRow.length; c++) {
    const raw = String(headerRow[c] ?? "").trim();
    if (!raw) continue;
    worksheetColIndices.push(c);
    rawHeaders.push(raw);
  }
  if (!rawHeaders.length) throw new Error("No column headers found in row 1.");

  const titles = uniquifyTitles(rawHeaders);
  if (titles.length > EXCEL_IMPORT_MAX_COLUMNS) {
    throw new Error(`Too many columns (max ${EXCEL_IMPORT_MAX_COLUMNS}).`);
  }

  const values: unknown[][] = titles.map(() => []);
  const formulas: (string | undefined)[][] = titles.map(() => []);
  const dataRowNumbers: number[] = [];

  for (let r = 1; r < matrix.length; r++) {
    if (dataRowNumbers.length >= EXCEL_IMPORT_MAX_ROWS) {
      throw new Error(`Too many data rows (max ${EXCEL_IMPORT_MAX_ROWS}).`);
    }
    const row = matrix[r]!;
    let any = false;
    const rowVals: unknown[] = [];
    for (let i = 0; i < worksheetColIndices.length; i++) {
      const v = row[worksheetColIndices[i]!] ?? "";
      rowVals.push(v);
      if (!isBlank(v)) any = true;
    }
    if (!any) continue;
    dataRowNumbers.push(r + 1);
    for (let i = 0; i < titles.length; i++) {
      values[i]!.push(rowVals[i]);
      formulas[i]!.push(undefined);
    }
  }

  return buildParsedWorkbook({
    sheetName: "CSV",
    worksheetColIndices,
    titles,
    values,
    formulas,
    dataRowNumbers,
  });
}

async function loadExcelJS() {
  const mod = await import("exceljs");
  return mod;
}

let excelJsPromise: Promise<typeof import("exceljs")> | null = null;

function getExcelJS() {
  if (!excelJsPromise) excelJsPromise = loadExcelJS();
  return excelJsPromise;
}

async function parseXlsxBuffer(buffer: Buffer): Promise<ExcelParsedWorkbook> {
  const ExcelJS = await getExcelJS();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("The workbook has no worksheets.");

  const maxCol = Math.min(worksheet.columnCount || 1, EXCEL_IMPORT_MAX_COLUMNS + 20);
  const headerRow = worksheet.getRow(1);
  const worksheetColIndices: number[] = [];
  const rawHeaders: string[] = [];

  for (let c = 1; c <= maxCol; c++) {
    const raw = cellDisplayString(extractCellValue(headerRow.getCell(c)));
    if (!raw.trim()) continue;
    worksheetColIndices.push(c - 1);
    rawHeaders.push(raw);
  }

  if (!rawHeaders.length) throw new Error("No column headers found in row 1.");
  const titles = uniquifyTitles(rawHeaders);
  if (titles.length > EXCEL_IMPORT_MAX_COLUMNS) {
    throw new Error(`Too many columns (max ${EXCEL_IMPORT_MAX_COLUMNS}).`);
  }

  const values: unknown[][] = titles.map(() => []);
  const formulas: (string | undefined)[][] = titles.map(() => []);
  const dataRowNumbers: number[] = [];
  const lastRow = Math.min(worksheet.rowCount || 1, EXCEL_IMPORT_MAX_ROWS + 1);

  for (let r = 2; r <= lastRow; r++) {
    const row = worksheet.getRow(r);
    const rowVals: unknown[] = [];
    const rowForms: (string | undefined)[] = [];
    let any = false;
    for (let i = 0; i < worksheetColIndices.length; i++) {
      const cell = row.getCell(worksheetColIndices[i]! + 1);
      const formula = extractCellFormula(cell);
      const val = extractCellValue(cell);
      rowVals.push(val);
      rowForms.push(formula);
      if (!isBlank(val) || formula) any = true;
    }
    if (!any) continue;
    if (dataRowNumbers.length >= EXCEL_IMPORT_MAX_ROWS) {
      throw new Error(`Too many data rows (max ${EXCEL_IMPORT_MAX_ROWS}).`);
    }
    dataRowNumbers.push(r);
    for (let i = 0; i < titles.length; i++) {
      values[i]!.push(rowVals[i]);
      formulas[i]!.push(rowForms[i]);
    }
  }

  return buildParsedWorkbook({
    sheetName: worksheet.name || "Sheet1",
    worksheetColIndices,
    titles,
    values,
    formulas,
    dataRowNumbers,
  });
}

/**
 * Parse an uploaded Excel (.xlsx) or CSV buffer into columns + values.
 */
export async function parseExcelImport(
  buffer: Buffer,
  filename: string,
): Promise<ExcelParsedWorkbook> {
  if (buffer.byteLength > EXCEL_IMPORT_MAX_BYTES) {
    throw new Error(`File is too large (max ${EXCEL_IMPORT_MAX_BYTES / (1024 * 1024)} MB).`);
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv")) return parseCsvBuffer(buffer);
  if (lower.endsWith(".xlsx")) return parseXlsxBuffer(buffer);
  throw new Error("Upload an .xlsx or .csv file.");
}

export function applyColumnOverrides(
  parsed: ExcelParsedWorkbook,
  overrides: ExcelImportOverride[] | undefined,
): ExcelImportColumn[] {
  const byIndex = new Map((overrides ?? []).map((o) => [o.sourceIndex, o]));
  const next = parsed.preview.columns.map((col) => {
    const o = byIndex.get(col.sourceIndex);
    if (!o) return { ...col };
    const typeRaw = o.type;
    let type: ExcelInferredType = col.type;
    let options = col.options ? [...col.options] : undefined;
    if (typeRaw === "NUMBER") {
      type = "TEXT_NUMBER";
      options = undefined;
    } else if (typeRaw) {
      type = typeRaw;
      if (type !== "PICKLIST") options = undefined;
      else if (o.options?.length) options = o.options;
    }
    if (o.options?.length && type === "PICKLIST") options = o.options;

    const title = o.title?.trim() ? o.title.trim().slice(0, SMARTSHEET_TITLE_MAX) : col.title;
    const included = o.included ?? col.included;
    let smartsheetFormula = col.smartsheetFormula;
    let formulaNote = col.formulaNote;
    if (o.applyFormula === false && (smartsheetFormula || col.hasExcelFormula)) {
      smartsheetFormula = undefined;
      formulaNote = "Excel formula noted; importing values as static data (formula not applied).";
    }
    return {
      ...col,
      title,
      type,
      options,
      included,
      smartsheetFormula,
      formulaNote,
    };
  });

  const titles = uniquifyTitles(next.map((c) => c.title));
  next.forEach((c, i) => {
    c.title = titles[i]!;
  });

  resolveFormulaNotes(next, parsed.columnFormulas, parsed.dataRowNumbers);

  // Re-apply applyFormula=false after re-resolve
  for (const col of next) {
    const o = byIndex.get(col.sourceIndex);
    if (o?.applyFormula === false && col.smartsheetFormula) {
      col.smartsheetFormula = undefined;
      col.formulaNote = "Excel formula noted; importing values as static data (formula not applied).";
    }
  }

  assignPrimary(next);
  return next;
}

/** Map a parsed cell value to a Smartsheet cell write value for the given type. */
export function cellValueForSmartsheet(
  type: ExcelInferredType,
  value: unknown,
): string | boolean | null {
  if (isBlank(value)) return null;
  if (type === "CHECKBOX") {
    return parseCheckbox(value);
  }
  if (type === "DATE") {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      const y = value.getUTCFullYear();
      const m = String(value.getUTCMonth() + 1).padStart(2, "0");
      const d = String(value.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    const s = cellDisplayString(value);
    const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (iso) return iso[1]!;
    const parsed = Date.parse(s);
    if (!Number.isNaN(parsed)) {
      const dt = new Date(parsed);
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
    return null;
  }
  return cellDisplayString(value);
}

export function columnsForCreateSheet(columns: ExcelImportColumn[]): {
  title: string;
  type: string;
  primary?: boolean;
  options?: string[];
}[] {
  return columns
    .filter((c) => c.included)
    .map((c) => ({
      title: c.title,
      type: c.type,
      primary: c.primary || undefined,
      options:
        c.type === "PICKLIST"
          ? c.options?.length
            ? c.options
            : ["Option 1", "Option 2"]
          : undefined,
    }));
}

/** Exported for tests. */
export const __test = { colLetterToIndex, indexToColLetter, cellDisplayString, looksLikePhone };
