export type RowOrigin = "import" | "local";

export type SheetColumnJson = {
  id: number;
  title: string;
  type?: string;
  index?: number;
  options?: string[];
  primary?: boolean;
  validation?: boolean;
  systemColumnType?: string;
  formula?: string;
  locked?: boolean;
  columnType?: string;
  [key: string]: unknown;
};

export type SheetCellJson = {
  columnId: number;
  value?: unknown;
  displayValue?: string;
  objectValue?: unknown;
  hyperlink?: { url?: string } | null;
};

export type SheetRowJson = {
  id: number;
  sheetId?: number;
  rowNumber?: number;
  createdAt?: string;
  modifiedAt?: string;
  cells?: SheetCellJson[];
};

export class SheetNotImportedError extends Error {
  readonly status = 503;

  constructor(kind: "sheet" | "report", id: string | number) {
    super(
      `This ${kind} (${id}) has not been imported. Import Smartsheet data while the API is on, then try again.`,
    );
    this.name = "SheetNotImportedError";
  }
}
