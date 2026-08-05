import { describe, expect, it } from "vitest";
import {
  buildSubmissionPdf,
  filterEntriesByInclude,
  formatPdfCellValue,
} from "@/lib/forms/pdf-mapping";
import { normalizePdfMappingConfig } from "@/lib/forms/pdf-mapping-types";
import { PDFDocument } from "pdf-lib";

describe("buildSubmissionPdf", () => {
  it("creates a multi-field form-style PDF", async () => {
    const bytes = await buildSubmissionPdf({
      formTitle: "Leave Request",
      formDescription: "Graduate School leave form",
      entries: [
        { label: "Full Name", columnTitle: "Full Name", value: "Ada Lovelace" },
        { label: "Consent", columnTitle: "Consent", value: "true" },
        { label: "Section", columnTitle: "__heading:1", value: "Approvals", kind: "heading" },
      ],
    });
    expect(bytes.byteLength).toBeGreaterThan(500);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("renders rich-text title, description, and headings", async () => {
    const bytes = await buildSubmissionPdf({
      formTitle: "<p><strong>Examination</strong> Scheduling Form</p>",
      formDescription: "<p>Complete <em>all</em> fields.</p><ul><li>Student section</li><li>Committee</li></ul>",
      entries: [
        { label: "Name", columnTitle: "Name", value: "Ada Lovelace" },
        {
          kind: "heading",
          label: "<p>Committee <u>members</u></p>",
          columnTitle: "__heading:1",
          value: "<p>Committee <u>members</u></p>",
        },
      ],
      config: normalizePdfMappingConfig({ enabled: true, theme: "official" }),
    });
    expect(bytes.byteLength).toBeGreaterThan(500);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});

describe("formatPdfCellValue / filterEntriesByInclude", () => {
  it("formats checkboxes and filters columns", () => {
    expect(formatPdfCellValue("true")).toBe("Yes");
    expect(formatPdfCellValue(false)).toBe("No");
    const filtered = filterEntriesByInclude(
      [
        { label: "A", columnTitle: "A", value: "1" },
        { label: "B", columnTitle: "B", value: "2" },
        { label: "H", columnTitle: "__h", value: "Hi", kind: "heading" },
      ],
      ["B"],
    );
    expect(filtered.map((e) => e.columnTitle)).toEqual(["B", "__h"]);
  });
});

describe("normalizePdfMappingConfig", () => {
  it("migrates legacy field maps to includeColumns", () => {
    const cfg = normalizePdfMappingConfig({
      enabled: true,
      outputFileName: "Out",
      fields: [
        { pdfField: "x", columnTitle: "Name" },
        { pdfField: "y", columnTitle: "" },
      ],
    });
    expect(cfg.outputFileName).toBe("Out.pdf");
    expect(cfg.includeColumns).toEqual(["Name"]);
  });

  it("keeps branding and layout options", () => {
    const cfg = normalizePdfMappingConfig({
      enabled: true,
      title: "Custom title",
      theme: "simple",
      layout: "twoColumn",
      density: "compact",
      showLogo: false,
    });
    expect(cfg.title).toBe("Custom title");
    expect(cfg.theme).toBe("simple");
    expect(cfg.layout).toBe("twoColumn");
    expect(cfg.density).toBe("compact");
    expect(cfg.showLogo).toBe(false);
  });

  it("defaults official theme to inline two-column draft style", () => {
    const cfg = normalizePdfMappingConfig({ enabled: true, theme: "official" });
    expect(cfg.theme).toBe("official");
    expect(cfg.layout).toBe("twoColumn");
    expect(cfg.fieldStyle).toBe("inline");
    expect(cfg.showDraftWatermark).toBe(true);
  });

  it("defaults unset theme to official Smartsheet style", () => {
    const cfg = normalizePdfMappingConfig({ enabled: true });
    expect(cfg.theme).toBe("official");
    expect(cfg.layout).toBe("twoColumn");
    expect(cfg.fieldStyle).toBe("inline");
    expect(cfg.showDraftWatermark).toBe(true);
  });
});
