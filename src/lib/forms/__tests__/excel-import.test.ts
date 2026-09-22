import { beforeAll, describe, expect, it } from "vitest";
import {
  applyColumnOverrides,
  cellValueForSmartsheet,
  convertExcelFormulaToSmartsheet,
  inferColumnType,
  normalizeFormulaPattern,
  parseExcelImport,
  uniquifyTitles,
  __test,
} from "@/lib/forms/excel-import";

/** Cached so cold exceljs load does not burn the first test's timeout. */
let ExcelJSModule: typeof import("exceljs") | null = null;

async function loadExcelJS() {
  if (!ExcelJSModule) ExcelJSModule = await import("exceljs");
  return ExcelJSModule;
}

async function workbookToBuffer(build: (wb: import("exceljs").Workbook) => void): Promise<Buffer> {
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  build(wb);
  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe("excel-import", () => {
  beforeAll(async () => {
    await loadExcelJS();
  }, 60_000);

  describe("uniquifyTitles", () => {
    it("fills empty headers and uniquifies duplicates", () => {
      expect(uniquifyTitles(["Name", "", "Name", "Name"])).toEqual([
        "Name",
        "Column 2",
        "Name (2)",
        "Name (3)",
      ]);
    });

    it("trims to Smartsheet title length", () => {
      const long = "A".repeat(60);
      const titles = uniquifyTitles([long]);
      expect(titles[0]!.length).toBeLessThanOrEqual(50);
    });
  });

  describe("inferColumnType", () => {
    it("infers DATE from date values", () => {
      expect(inferColumnType([new Date("2026-01-01"), new Date("2026-02-01")]).type).toBe("DATE");
    });

    it("infers CHECKBOX from yes/no", () => {
      expect(inferColumnType(["yes", "no", "YES", "No"]).type).toBe("CHECKBOX");
    });

    it("infers PHONE from phone-like strings", () => {
      expect(inferColumnType(["(509) 555-0100", "509-555-0199"]).type).toBe("PHONE");
    });

    it("infers PICKLIST for low-cardinality repeated text", () => {
      const values = ["Academics", "IT", "Academics", "IT", "Facilities", "IT", "Academics"];
      const inferred = inferColumnType(values);
      expect(inferred.type).toBe("PICKLIST");
      expect(inferred.options).toEqual(expect.arrayContaining(["Academics", "IT", "Facilities"]));
    });

    it("defaults to TEXT_NUMBER for unique free text", () => {
      expect(inferColumnType(["Ada", "Grace", "Alan", "Katherine"]).type).toBe("TEXT_NUMBER");
    });
  });

  describe("formula conversion", () => {
    it("normalizes same-row A1 refs to a comparable pattern", () => {
      expect(normalizeFormulaPattern("=B2*C2", 2)).toBe("B{ROW}*C{ROW}");
      expect(normalizeFormulaPattern("=B3*C3", 3)).toBe("B{ROW}*C{ROW}");
    });

    it("converts same-row formulas to Smartsheet column formulas", () => {
      const titles = new Map([
        [0, "Qty"],
        [1, "Price"],
        [2, "Total"],
      ]);
      expect(convertExcelFormulaToSmartsheet("=A2*B2", 2, titles)).toBe("=[Qty]@row*[Price]@row");
    });

    it("rejects VLOOKUP and other-sheet refs", () => {
      const titles = new Map([
        [0, "Name"],
        [1, "Lookup"],
      ]);
      expect(convertExcelFormulaToSmartsheet("=VLOOKUP(A2,Sheet2!A:B,2,FALSE)", 2, titles)).toBeNull();
      expect(convertExcelFormulaToSmartsheet("=Sheet2!A2", 2, titles)).toBeNull();
    });

    it("rejects absolute and other-row refs", () => {
      const titles = new Map([
        [0, "A"],
        [1, "B"],
      ]);
      expect(convertExcelFormulaToSmartsheet("=$A$2+B2", 2, titles)).toBeNull();
      expect(convertExcelFormulaToSmartsheet("=A1+B2", 2, titles)).toBeNull();
    });
  });

  describe("parseExcelImport", () => {
    it(
      "parses headers, data rows, and type inference from xlsx",
      async () => {
        const buffer = await workbookToBuffer((wb) => {
          const ws = wb.addWorksheet("Requests");
          ws.addRow(["Full Name", "Department", "Active"]);
          ws.addRow(["Ada Lovelace", "Academics", "yes"]);
          ws.addRow(["Grace Hopper", "IT", "no"]);
          ws.addRow(["Alan Turing", "Academics", "yes"]);
        });

        const parsed = await parseExcelImport(buffer, "requests.xlsx");
        expect(parsed.preview.sheetName).toBe("Requests");
        expect(parsed.preview.rowCount).toBe(3);
        expect(parsed.preview.columns.map((c) => c.title)).toEqual(["Full Name", "Department", "Active"]);
        expect(parsed.preview.columns[0]!.primary).toBe(true);
        expect(parsed.preview.columns[1]!.type).toBe("PICKLIST");
        expect(parsed.preview.columns[2]!.type).toBe("CHECKBOX");
      },
      30_000,
    );

    it(
      "skips empty header columns and uniquifies duplicates",
      async () => {
        const buffer = await workbookToBuffer((wb) => {
          const ws = wb.addWorksheet("Sheet1");
          ws.addRow(["Name", "", "Name"]);
          ws.addRow(["Ada", "x", "Grace"]);
        });
        const parsed = await parseExcelImport(buffer, "dup.xlsx");
        expect(parsed.preview.columns.map((c) => c.title)).toEqual(["Name", "Name (2)"]);
      },
      30_000,
    );

    it(
      "detects and converts same-row Excel formulas",
      async () => {
        const buffer = await workbookToBuffer((wb) => {
          const ws = wb.addWorksheet("Sheet1");
          ws.addRow(["Qty", "Price", "Total"]);
          const r2 = ws.addRow([2, 10, null]);
          r2.getCell(3).value = { formula: "A2*B2", result: 20 };
          const r3 = ws.addRow([3, 5, null]);
          r3.getCell(3).value = { formula: "A3*B3", result: 15 };
        });

        const parsed = await parseExcelImport(buffer, "calc.xlsx");
        const total = parsed.preview.columns.find((c) => c.title === "Total");
        expect(total?.hasExcelFormula).toBe(true);
        expect(total?.smartsheetFormula).toBe("=[Qty]@row*[Price]@row");
        expect(total?.primary).not.toBe(true);
        expect(parsed.preview.columns[0]!.primary).toBe(true);
      },
      30_000,
    );

    it(
      "flags unsafe formulas without converting",
      async () => {
        const buffer = await workbookToBuffer((wb) => {
          const ws = wb.addWorksheet("Sheet1");
          ws.addRow(["Key", "Lookup"]);
          const r2 = ws.addRow(["A", null]);
          r2.getCell(2).value = { formula: "VLOOKUP(A2,Sheet2!A:B,2,FALSE)", result: "x" };
          const r3 = ws.addRow(["B", null]);
          r3.getCell(2).value = { formula: "VLOOKUP(A3,Sheet2!A:B,2,FALSE)", result: "y" };
        });

        const parsed = await parseExcelImport(buffer, "lookup.xlsx");
        const lookup = parsed.preview.columns.find((c) => c.title === "Lookup");
        expect(lookup?.hasExcelFormula).toBe(true);
        expect(lookup?.smartsheetFormula).toBeUndefined();
        expect(lookup?.formulaNote).toMatch(/static data/i);
      },
      30_000,
    );

    it("parses CSV without formulas", async () => {
      const csv = "Name,Email\nAda,ada@wsu.edu\nGrace,grace@wsu.edu\n";
      const parsed = await parseExcelImport(Buffer.from(csv, "utf8"), "people.csv");
      expect(parsed.preview.rowCount).toBe(2);
      expect(parsed.preview.columns).toHaveLength(2);
      expect(parsed.preview.columns.every((c) => !c.hasExcelFormula)).toBe(true);
    });
  });

  describe("applyColumnOverrides", () => {
    it(
      "renames, excludes, and toggles formula application",
      async () => {
        const buffer = await workbookToBuffer((wb) => {
          const ws = wb.addWorksheet("Sheet1");
          ws.addRow(["Qty", "Price", "Total"]);
          const r2 = ws.addRow([2, 10, null]);
          r2.getCell(3).value = { formula: "A2*B2", result: 20 };
        });
        const parsed = await parseExcelImport(buffer, "calc.xlsx");
        const totalIdx = parsed.preview.columns.find((c) => c.title === "Total")!.sourceIndex;

        const next = applyColumnOverrides(parsed, [
          { sourceIndex: 0, title: "Quantity" },
          { sourceIndex: totalIdx, applyFormula: false, included: true },
        ]);
        expect(next.find((c) => c.sourceIndex === 0)?.title).toBe("Quantity");
        const total = next.find((c) => c.sourceIndex === totalIdx)!;
        expect(total.smartsheetFormula).toBeUndefined();
        expect(total.formulaNote).toMatch(/not applied/i);
      },
      30_000,
    );
  });

  describe("cellValueForSmartsheet", () => {
    it("formats dates and checkboxes", () => {
      expect(cellValueForSmartsheet("DATE", new Date(Date.UTC(2026, 6, 15)))).toBe("2026-07-15");
      expect(cellValueForSmartsheet("CHECKBOX", "yes")).toBe(true);
      expect(cellValueForSmartsheet("CHECKBOX", "no")).toBe(false);
      expect(cellValueForSmartsheet("TEXT_NUMBER", "  hi ")).toBe("hi");
    });
  });

  describe("column letter helpers", () => {
    it("round-trips A1 letters", () => {
      expect(__test.indexToColLetter(0)).toBe("A");
      expect(__test.indexToColLetter(25)).toBe("Z");
      expect(__test.indexToColLetter(26)).toBe("AA");
      expect(__test.colLetterToIndex("A")).toBe(0);
      expect(__test.colLetterToIndex("AA")).toBe(26);
    });
  });
});
