/** Shared Excel-import types (safe for client components — no exceljs). */

export type ExcelInferredType =
  | "TEXT_NUMBER"
  | "PICKLIST"
  | "CHECKBOX"
  | "DATE"
  | "PHONE";

export type ExcelEditableType = ExcelInferredType | "NUMBER";

export interface ExcelImportColumn {
  /** 0-based worksheet column index (A=0). */
  sourceIndex: number;
  title: string;
  type: ExcelInferredType;
  options?: string[];
  primary?: boolean;
  /** True when Excel cells used formulas in this column. */
  hasExcelFormula: boolean;
  /** Converted Smartsheet column formula when safe; otherwise undefined. */
  smartsheetFormula?: string;
  /** Human-readable note about formula handling. */
  formulaNote?: string;
  /** Sample display values (first few non-empty). */
  sampleValues: string[];
  included: boolean;
  /** Client-side: whether to apply smartsheetFormula on create (default true when formula exists). */
  applyFormula?: boolean;
}

export interface ExcelImportPreview {
  columns: ExcelImportColumn[];
  rowCount: number;
  sheetName: string;
}

export interface ExcelImportOverride {
  sourceIndex: number;
  title?: string;
  type?: ExcelEditableType;
  options?: string[];
  included?: boolean;
  /** When false, skip applying a converted Smartsheet formula even if available. */
  applyFormula?: boolean;
}
