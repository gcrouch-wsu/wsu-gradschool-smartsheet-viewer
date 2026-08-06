export type PdfLayoutMode = "stacked" | "twoColumn";
export type PdfDensity = "compact" | "comfortable";
export type PdfTheme = "wsu" | "simple" | "official";
export type PdfFieldDisplay = "boxed" | "inline" | "underline";

export type PdfFieldEntry = {
  /** Display label (form label or column title). */
  label: string;
  /** Sheet column title used for inclusion / lookup. */
  columnTitle: string;
  value: string;
  /** Optional layout kind for headings/descriptions in the PDF. */
  kind?: "field" | "heading" | "description" | "divider";
  display?: PdfFieldDisplay;
};

export type PdfCustomItem =
  | {
      id: string;
      kind: "field";
      columnTitle: string;
      label?: string;
      included: boolean;
      display?: PdfFieldDisplay;
    }
  | { id: string; kind: "heading"; text: string }
  | { id: string; kind: "description"; text: string }
  | { id: string; kind: "divider" };

export type PdfMappingConfig = {
  enabled: boolean;
  outputFileName: string;
  /**
   * Column titles to include. Empty/undefined = all visible form fields.
   * Legacy — prefer `items` when present.
   */
  includeColumns?: string[] | null;
  /** Override display labels keyed by column title. */
  fieldLabels?: Record<string, string>;
  /** Ordered PDF content. Null = form layout order. */
  items?: PdfCustomItem[] | null;
  title?: string;
  description?: string;
  showLogo?: boolean;
  showCrimsonBar?: boolean;
  showFooter?: boolean;
  footerText?: string;
  layout?: PdfLayoutMode;
  density?: PdfDensity;
  theme?: PdfTheme;
  fieldStyle?: PdfFieldDisplay;
  bannerText?: string;
  showDraftWatermark?: boolean;
};

export type PdfMappingRecord = {
  config: PdfMappingConfig;
  templateName: string | null;
  hasTemplate: boolean;
};

export const DEFAULT_PDF_OUTPUT_FILENAME = "Final PDF.pdf";
export const DEFAULT_PDF_FOOTER = "Washington State University Graduate School";
export const DEFAULT_PDF_DRAFT_BANNER = "DRAFT – DO NOT SUBMIT THIS VERSION TO THE GRADUATE SCHOOL";

export function defaultPdfMappingConfig(): PdfMappingConfig {
  return {
    enabled: false,
    outputFileName: DEFAULT_PDF_OUTPUT_FILENAME,
    includeColumns: null,
    fieldLabels: {},
    items: null,
    title: "",
    description: "",
    showLogo: true,
    showCrimsonBar: false,
    showFooter: true,
    footerText: DEFAULT_PDF_DRAFT_BANNER,
    layout: "twoColumn",
    density: "comfortable",
    theme: "official",
    fieldStyle: "inline",
    bannerText: DEFAULT_PDF_DRAFT_BANNER,
    showDraftWatermark: true,
  };
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function newItemId(prefix: string): string {
  return `${prefix}:${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function normalizePdfCustomItem(raw: unknown, index: number): PdfCustomItem | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const kind = String(data.kind ?? "");
  if (kind === "field") {
    const columnTitle = String(data.columnTitle ?? "").trim();
    if (!columnTitle) return null;
    return {
      id: String(data.id ?? `field:${columnTitle}:${index}`),
      kind: "field",
      columnTitle,
      label: asString(data.label).trim() || undefined,
      included: data.included !== false,
      display:
        data.display === "inline" || data.display === "underline" || data.display === "boxed"
          ? data.display
          : undefined,
    };
  }
  if (kind === "heading") {
    return {
      id: String(data.id ?? newItemId("heading")),
      kind: "heading",
      text: asString(data.text),
    };
  }
  if (kind === "description") {
    return {
      id: String(data.id ?? newItemId("description")),
      kind: "description",
      text: asString(data.text),
    };
  }
  if (kind === "divider") {
    return { id: String(data.id ?? newItemId("divider")), kind: "divider" };
  }
  return null;
}

export function normalizePdfMappingConfig(raw: unknown): PdfMappingConfig {
  const fallback = defaultPdfMappingConfig();
  if (!raw || typeof raw !== "object") return fallback;
  const data = raw as Record<string, unknown>;

  let includeColumns: string[] | null = null;
  if (Array.isArray(data.includeColumns)) {
    includeColumns = data.includeColumns
      .map((t) => String(t ?? "").trim())
      .filter(Boolean);
  } else if (Array.isArray(data.fields) && !Array.isArray(data.items)) {
    includeColumns = (data.fields as Array<Record<string, unknown>>)
      .map((f) => String(f.columnTitle ?? "").trim())
      .filter(Boolean);
  }

  const fieldLabels: Record<string, string> = {};
  if (data.fieldLabels && typeof data.fieldLabels === "object" && !Array.isArray(data.fieldLabels)) {
    for (const [key, value] of Object.entries(data.fieldLabels as Record<string, unknown>)) {
      const title = key.trim();
      const label = String(value ?? "").trim();
      if (title && label) fieldLabels[title] = label;
    }
  }

  let items: PdfCustomItem[] | null = null;
  if (Array.isArray(data.items)) {
    items = data.items
      .map((item, index) => normalizePdfCustomItem(item, index))
      .filter((item): item is PdfCustomItem => Boolean(item));
  }

  let outputFileName = String(data.outputFileName ?? "").trim() || fallback.outputFileName;
  if (!outputFileName.toLowerCase().endsWith(".pdf")) {
    outputFileName = `${outputFileName}.pdf`;
  }

  const density = data.density === "compact" ? "compact" : "comfortable";
  const theme =
    data.theme === "simple" || data.theme === "wsu" || data.theme === "official" ? data.theme : fallback.theme;
  const layout =
    data.layout === "twoColumn" || data.layout === "stacked"
      ? data.layout
      : theme === "official"
        ? "twoColumn"
        : "stacked";
  const fieldStyle =
    data.fieldStyle === "inline" || data.fieldStyle === "underline" || data.fieldStyle === "boxed"
      ? data.fieldStyle
      : theme === "official"
        ? "inline"
        : "boxed";

  return {
    enabled: Boolean(data.enabled),
    outputFileName,
    includeColumns,
    fieldLabels,
    items,
    title: asString(data.title),
    description: asString(data.description),
    showLogo: data.showLogo !== false,
    showCrimsonBar: theme === "official" ? Boolean(data.showCrimsonBar) : data.showCrimsonBar !== false,
    showFooter: data.showFooter !== false,
    footerText: asString(data.footerText) || fallback.footerText,
    layout,
    density,
    theme,
    fieldStyle,
    bannerText: asString(data.bannerText),
    showDraftWatermark:
      theme === "official" ? data.showDraftWatermark !== false : Boolean(data.showDraftWatermark),
  };
}
