import { describe, expect, it } from "vitest";

import type { ResolvedFieldValue, ResolvedViewRow, SmartsheetCell, SmartsheetRow } from "@/lib/config/types";
import { applyViewFilters, sortResolvedRows } from "@/lib/filters";
import { normalizeColumnKey } from "@/lib/smartsheet-column-key";

function createCell(columnId: number, columnTitle: string, value: unknown): SmartsheetCell {
  return {
    columnId,
    columnTitle,
    columnType: "TEXT_NUMBER",
    value,
  };
}

function createRow(id: number, cells: SmartsheetCell[]): SmartsheetRow {
  return {
    id,
    cellsById: Object.fromEntries(cells.map((cell) => [cell.columnId, cell])),
    cellsByTitle: Object.fromEntries(cells.map((cell) => [normalizeColumnKey(cell.columnTitle), cell])),
  };
}

function createResolvedField(key: string, textValue: string): ResolvedFieldValue {
  return {
    key,
    label: key,
    renderType: "text",
    textValue,
    listValue: textValue ? [textValue] : [],
    links: [],
    isEmpty: !textValue,
    hideWhenEmpty: false,
  };
}

function createResolvedRow(id: number, fields: Record<string, string>): ResolvedViewRow {
  const resolvedFields = Object.entries(fields).map(([key, value]) => createResolvedField(key, value));
  return {
    id,
    fields: resolvedFields,
    fieldMap: Object.fromEntries(resolvedFields.map((field) => [field.key, field])),
  };
}

describe("filters — contact columns", () => {
  it("does not match objectType metadata strings as filterable values", () => {
    const contactCell: SmartsheetCell = {
      columnId: 10,
      columnTitle: "Director",
      columnType: "CONTACT_LIST",
      value: "director@wsu.edu",
      displayValue: "Dr. Smith",
      objectValue: { objectType: "CONTACT", email: "director@wsu.edu", name: "Dr. Smith" },
    };
    const rows = [createRow(1, [contactCell])];

    // "contact" is an objectType literal — should NOT match
    expect(applyViewFilters(rows, [{ columnTitle: "Director", op: "contains", value: "contact" }])).toHaveLength(0);

    // email should match
    expect(applyViewFilters(rows, [{ columnTitle: "Director", op: "contains", value: "director@wsu.edu" }])).toHaveLength(1);

    // name should match
    expect(applyViewFilters(rows, [{ columnTitle: "Director", op: "contains", value: "dr. smith" }])).toHaveLength(1);
  });

  it("matches values inside MULTI_CONTACT objectValue", () => {
    const multiContactCell: SmartsheetCell = {
      columnId: 10,
      columnTitle: "Coordinators",
      columnType: "MULTI_CONTACT_LIST",
      value: null,
      objectValue: {
        objectType: "MULTI_CONTACT",
        values: [
          { objectType: "CONTACT", email: "alpha@wsu.edu", name: "Alpha" },
          { objectType: "CONTACT", email: "beta@wsu.edu", name: "Beta" },
        ],
      },
    };
    const rows = [createRow(1, [multiContactCell])];

    // "multi_contact" literal should NOT match
    expect(applyViewFilters(rows, [{ columnTitle: "Coordinators", op: "contains", value: "multi_contact" }])).toHaveLength(0);

    // actual email should match
    expect(applyViewFilters(rows, [{ columnTitle: "Coordinators", op: "contains", value: "alpha@wsu.edu" }])).toHaveLength(1);
  });
});

describe("filters", () => {
  it("applies filter operators using normalized column titles", () => {
    const rows = [
      createRow(1, [createCell(10, "Program Name", "Biological Sciences"), createCell(11, "Status", "Active")]),
      createRow(2, [createCell(10, "Program Name", "Chemistry"), createCell(11, "Status", "Archived")]),
      createRow(3, [createCell(10, "Program Name", ""), createCell(11, "Status", "Pending")]),
    ];

    expect(
      applyViewFilters(rows, [{ columnTitle: " program name ", op: "contains", value: "science" }]).map(
        (row) => row.id
      )
    ).toEqual([1]);

    expect(applyViewFilters(rows, [{ columnTitle: "Program Name", op: "not_empty" }]).map((row) => row.id)).toEqual([
      1,
      2,
    ]);

    expect(applyViewFilters(rows, [{ columnTitle: "Program Name", op: "is_empty" }]).map((row) => row.id)).toEqual([
      3,
    ]);

    expect(applyViewFilters(rows, [{ columnTitle: "Status", op: "in", value: ["active", "pending"] }]).map((row) => row.id)).toEqual([
      1,
      3,
    ]);
  });
});

describe("sorting", () => {
  it("uses sortValue over textValue when sorting date fields", () => {
    // "Feb 1, 2024" > "Jan 15, 2024" alphabetically → wrong order without sortValue
    // sortValue ISO strings sort correctly
    function makeDateRow(id: number, textValue: string, isoValue: string): ResolvedViewRow {
      const field: ResolvedFieldValue = {
        key: "startDate",
        label: "Start Date",
        renderType: "date",
        textValue,
        sortValue: isoValue,
        listValue: [textValue],
        links: [],
        isEmpty: false,
        hideWhenEmpty: false,
      };
      return { id, fields: [field], fieldMap: { startDate: field } };
    }

    const rows = [
      makeDateRow(1, "Feb 1, 2024", "2024-02-01T00:00:00.000Z"),
      makeDateRow(2, "Jan 15, 2024", "2024-01-15T00:00:00.000Z"),
      makeDateRow(3, "Mar 3, 2024", "2024-03-03T00:00:00.000Z"),
    ];

    expect(sortResolvedRows(rows, [{ field: "startDate", direction: "asc" }]).map((row) => row.id)).toEqual([2, 1, 3]);
    expect(sortResolvedRows(rows, [{ field: "startDate", direction: "desc" }]).map((row) => row.id)).toEqual([3, 1, 2]);
  });

  it("sorts numerically and falls back to row id for stable ties", () => {
    const rows = [
      createResolvedRow(30, { programName: "Biology", order: "10" }),
      createResolvedRow(20, { programName: "Biology", order: "2" }),
      createResolvedRow(10, { programName: "Biology", order: "2" }),
    ];

    expect(sortResolvedRows(rows, [{ field: "order", direction: "asc" }]).map((row) => row.id)).toEqual([
      10,
      20,
      30,
    ]);
  });
});
