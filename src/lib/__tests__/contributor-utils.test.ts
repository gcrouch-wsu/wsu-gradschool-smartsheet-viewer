import { describe, expect, it } from "vitest";
import {
  buildContributorEditingClientConfig,
  collectResolvableRowIdsForUnrestrictedEditing,
  contributorEditTargetRowId,
  getContributorEditingValidationErrors,
  getEligibleEditableFieldDefinitions,
  hasMultiPersonValidationErrors,
  isContributorRowOrMergedEditable,
  isEditableFieldDirectMapped,
  mergeContributorContactPayloadWithExistingRow,
  parseMultiPersonValue,
  parseMultiPersonRow,
  serializeContactDisplayToObjectValue,
  serializeMultiPersonToCells,
  validateContributorPicklistCells,
  validateMultiPersonGroupsForSave,
  pruneStaleContributorColumnIds,
  type MultiPersonEntry,
} from "@/lib/contributor-utils";
import type {
  EditableFieldGroup,
  ResolvedViewRow,
  SmartsheetColumn,
  SmartsheetRow,
  SourceConfig,
  ViewConfig,
} from "@/lib/config/types";

describe("mergeContributorContactPayloadWithExistingRow", () => {
  it("merges existing email when CONTACT_LIST payload is name-only", () => {
    const row: SmartsheetRow = {
      id: 1,
      cellsById: {
        10: {
          columnId: 10,
          columnTitle: "Lead",
          columnType: "CONTACT_LIST",
          value: "",
          objectValue: { objectType: "CONTACT", name: "Prior", email: "keep@wsu.edu" },
        },
      },
      cellsByTitle: {},
    };
    const columnTypeById = new Map<number, string>([[10, "CONTACT_LIST"]]);
    const cells = [{ columnId: 10, objectValue: { objectType: "CONTACT", name: "Updated" } }];
    expect(mergeContributorContactPayloadWithExistingRow(cells, row, columnTypeById)).toEqual([
      { columnId: 10, objectValue: { objectType: "CONTACT", name: "Updated", email: "keep@wsu.edu" } },
    ]);
  });

  it("merges existing name when CONTACT_LIST payload is email-only", () => {
    const row: SmartsheetRow = {
      id: 1,
      cellsById: {
        10: {
          columnId: 10,
          columnTitle: "Lead",
          columnType: "CONTACT_LIST",
          value: "",
          objectValue: { objectType: "CONTACT", name: "Pat", email: "old@wsu.edu" },
        },
      },
      cellsByTitle: {},
    };
    const columnTypeById = new Map<number, string>([[10, "CONTACT_LIST"]]);
    const cells = [{ columnId: 10, objectValue: { objectType: "CONTACT", email: "new@wsu.edu" } }];
    expect(mergeContributorContactPayloadWithExistingRow(cells, row, columnTypeById)).toEqual([
      { columnId: 10, objectValue: { objectType: "CONTACT", name: "Pat", email: "new@wsu.edu" } },
    ]);
  });
});

describe("isContributorRowOrMergedEditable and contributorEditTargetRowId", () => {
  const baseRow = (): ResolvedViewRow => ({
    id: 1,
    fields: [],
    fieldMap: {},
  });

  it("returns false when editable set is missing or empty", () => {
    const row = baseRow();
    expect(isContributorRowOrMergedEditable(row, undefined)).toBe(false);
    expect(isContributorRowOrMergedEditable(row, new Set())).toBe(false);
  });

  it("treats primary id as editable", () => {
    const row = baseRow();
    expect(isContributorRowOrMergedEditable(row, new Set([1]))).toBe(true);
    expect(contributorEditTargetRowId(row, new Set([1]))).toBe(1);
  });

  it("treats merged source id as editable when only source ids match the set", () => {
    const row: ResolvedViewRow = { ...baseRow(), id: 10, mergedSourceRowIds: [10, 20, 30] };
    expect(isContributorRowOrMergedEditable(row, new Set([20]))).toBe(true);
    expect(contributorEditTargetRowId(row, new Set([20]))).toBe(20);
  });

  it("prefers display row id for edit target when it is in the editable set", () => {
    const row: ResolvedViewRow = { ...baseRow(), id: 10, mergedSourceRowIds: [10, 20] };
    expect(contributorEditTargetRowId(row, new Set([10, 20]))).toBe(10);
  });

  it("falls back to display id when nothing in the set applies", () => {
    const row: ResolvedViewRow = { ...baseRow(), id: 10, mergedSourceRowIds: [10, 20] };
    expect(isContributorRowOrMergedEditable(row, new Set([99]))).toBe(false);
    expect(contributorEditTargetRowId(row, new Set([99]))).toBe(10);
  });
});

describe("collectResolvableRowIdsForUnrestrictedEditing", () => {
  it("dedupes display and merged source ids", () => {
    const rows: ResolvedViewRow[] = [
      { id: 1, fields: [], fieldMap: {}, mergedSourceRowIds: [1, 2] },
      { id: 3, fields: [], fieldMap: {} },
    ];
    expect(collectResolvableRowIdsForUnrestrictedEditing(rows).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });
});

describe("serializeContactDisplayToObjectValue", () => {
  it("returns null for empty CONTACT_LIST so callers send value clear", () => {
    expect(serializeContactDisplayToObjectValue("", "CONTACT_LIST", "email")).toBeNull();
    expect(serializeContactDisplayToObjectValue("  , ;  ", "CONTACT_LIST", "name")).toBeNull();
  });

  it("returns null for empty MULTI_CONTACT_LIST so callers send value clear (error 1012 rejects empty values array)", () => {
    expect(serializeContactDisplayToObjectValue("", "MULTI_CONTACT_LIST", "email")).toBeNull();
    expect(serializeContactDisplayToObjectValue("  , ;  ", "MULTI_CONTACT_LIST", "name")).toBeNull();
  });

  it("serializes single contact", () => {
    expect(serializeContactDisplayToObjectValue("a@b.com", "CONTACT_LIST", "email")).toEqual({
      objectType: "CONTACT",
      email: "a@b.com",
    });
    expect(serializeContactDisplayToObjectValue("Pat", "CONTACT_LIST", "name")).toEqual({
      objectType: "CONTACT",
      name: "Pat",
    });
  });
});

describe("isEditableFieldDirectMapped and picklist / hidden campus-style fields", () => {
  function col(partial: { id: number; title: string; type: string; options?: string[] }): SmartsheetColumn {
    return {
      id: partial.id,
      index: 0,
      title: partial.title,
      type: partial.type,
      options: partial.options,
    };
  }

  it("treats single PICKLIST as editable when render type is still list (e.g. after changing column from multi to single)", () => {
    const field = {
      key: "campus",
      label: "Campus",
      source: { columnId: 101, columnTitle: "Grad Campus" },
      render: { type: "list" as const },
      transforms: [{ op: "split" as const, args: { delimiter: "," } }],
    };
    const column = col({ id: 101, title: "Grad Campus", type: "PICKLIST", options: ["Pullman", "Spokane"] });
    expect(isEditableFieldDirectMapped(field, column)).toBe(true);
    const eligible = getEligibleEditableFieldDefinitions(
      { id: "v", fields: [field] } as unknown as ViewConfig,
      [column],
    );
    expect(eligible.some((e) => e.fieldKey === "campus" && e.columnType === "PICKLIST")).toBe(true);
  });

  it("allows hidden non-contact columns when the sheet column is editable (e.g. hidden campus)", () => {
    const field = {
      key: "campus",
      label: "Campus",
      source: { columnId: 101, columnTitle: "Grad Campus" },
      render: { type: "hidden" as const },
    };
    const column = col({ id: 101, title: "Grad Campus", type: "PICKLIST", options: ["Pullman"] });
    expect(isEditableFieldDirectMapped(field, column)).toBe(true);
  });
});

describe("validateContributorPicklistCells", () => {
  function col(partial: { id: number; title: string; type: string; options?: string[] }): SmartsheetColumn {
    return {
      id: partial.id,
      index: 0,
      title: partial.title,
      type: partial.type,
      options: partial.options,
    };
  }

  it("allows empty value and skips columns without options", () => {
    const map = new Map<number, SmartsheetColumn>([
      [1, col({ id: 1, title: "Status", type: "PICKLIST", options: ["A", "B"] })],
    ]);
    expect(validateContributorPicklistCells([{ columnId: 1, value: "" }], map)).toEqual({ ok: true });
    const noOpts = new Map([[2, col({ id: 2, title: "Free", type: "PICKLIST", options: [] })]]);
    expect(validateContributorPicklistCells([{ columnId: 2, value: "anything" }], noOpts)).toEqual({ ok: true });
  });

  it("rejects value not in options", () => {
    const map = new Map([[1, col({ id: 1, title: "Status", type: "PICKLIST", options: ["A", "B"] })]]);
    const r = validateContributorPicklistCells([{ columnId: 1, value: "Z" }], map);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("Z");
      expect(r.error).toContain("Status");
    }
  });

  it("rejects objectValue on picklist", () => {
    const map = new Map([[1, col({ id: 1, title: "Status", type: "PICKLIST", options: ["A"] })]]);
    expect(validateContributorPicklistCells([{ columnId: 1, value: "A", objectValue: {} }], map)).toEqual({
      ok: false,
      error: "Picklist fields must send a plain value, not objectValue.",
    });
  });

  it("ignores non-picklist columns", () => {
    const map = new Map([[9, col({ id: 9, title: "Note", type: "TEXT_NUMBER" })]]);
    expect(validateContributorPicklistCells([{ columnId: 9, value: "x" }], map)).toEqual({ ok: true });
  });
});

describe("validateMultiPersonGroupsForSave", () => {
  const group: EditableFieldGroup = {
    id: "g1",
    label: "Coordinators",
    attributes: [
      { attribute: "name", fieldKey: "n", columnId: 1 },
      { attribute: "email", fieldKey: "e", columnId: 2 },
    ],
  };

  it("allows empty group", () => {
    const v = validateMultiPersonGroupsForSave([group], { g1: [] });
    expect(hasMultiPersonValidationErrors(v)).toBe(false);
  });

  it("allows name-only or email-only rows when both attributes exist (legacy / partial sheet data)", () => {
    expect(
      hasMultiPersonValidationErrors(
        validateMultiPersonGroupsForSave([group], {
          g1: [{ name: "", email: "a@b.com", phone: "", campus: "" }],
        }),
      ),
    ).toBe(false);
    expect(
      hasMultiPersonValidationErrors(
        validateMultiPersonGroupsForSave([group], {
          g1: [{ name: "Ada", email: "", phone: "", campus: "" }],
        }),
      ),
    ).toBe(false);
  });

  it("passes when name and email filled", () => {
    const v = validateMultiPersonGroupsForSave([group], {
      g1: [{ name: "Ada", email: "a@b.com", phone: "", campus: "" }],
    });
    expect(hasMultiPersonValidationErrors(v)).toBe(false);
  });

  it("ignores wholly empty person rows (unused fixed slots)", () => {
    const v = validateMultiPersonGroupsForSave([group], {
      g1: [
        { name: "Ada", email: "a@b.com", phone: "", campus: "" },
        { name: "", email: "", phone: "", campus: "" },
      ],
    });
    expect(hasMultiPersonValidationErrors(v)).toBe(false);
  });

  it("treats campus-only rows as unused (optional numbered slots)", () => {
    const withCampus: EditableFieldGroup = {
      ...group,
      attributes: [
        ...group.attributes,
        { attribute: "campus", fieldKey: "c", columnId: 3 },
      ],
    };
    const v = validateMultiPersonGroupsForSave([withCampus], {
      g1: [
        { name: "Ada", email: "a@b.com", phone: "", campus: "" },
        { name: "", email: "", phone: "", campus: "Pullman" },
      ],
    });
    expect(hasMultiPersonValidationErrors(v)).toBe(false);
  });
});

describe("parseMultiPersonValue", () => {
  it("splits on newlines (stacked list display)", () => {
    expect(parseMultiPersonValue("test\ntest2")).toEqual(["test", "test2"]);
    expect(parseMultiPersonValue("a\r\nb")).toEqual(["a", "b"]);
  });

  it("splits by comma", () => {
    expect(parseMultiPersonValue("lisa lujan, deb marsh")).toEqual(["lisa lujan", "deb marsh"]);
  });

  it("splits by semicolon", () => {
    expect(parseMultiPersonValue("lisa lujan; deb marsh")).toEqual(["lisa lujan", "deb marsh"]);
  });

  it("handles mixed delimiters", () => {
    expect(parseMultiPersonValue("a, b; c")).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace", () => {
    expect(parseMultiPersonValue("  alice  ,  bob  ")).toEqual(["alice", "bob"]);
  });

  it("returns empty array for empty input", () => {
    expect(parseMultiPersonValue("")).toEqual([]);
    expect(parseMultiPersonValue(null)).toEqual([]);
    expect(parseMultiPersonValue(undefined)).toEqual([]);
  });
});

describe("parseMultiPersonRow", () => {
  function makeRow(fieldMap: Record<string, { textValue: string }>): ResolvedViewRow {
    return {
      id: 1,
      fields: [],
      fieldMap: Object.fromEntries(
        Object.entries(fieldMap).map(([key, v]) => [
          key,
          {
            key,
            label: key,
            renderType: "text" as const,
            textValue: v.textValue,
            listValue: [],
            links: [],
            isEmpty: !v.textValue,
            hideWhenEmpty: false,
          },
        ]),
      ),
    };
  }

  it("parses parallel columns into person entries", () => {
    const row = makeRow({
      coordinator: { textValue: "lisa lujan, deb marsh" },
      coordinator_email: { textValue: "llujan@wsu.edu, marshdj@wsu.edu" },
    });
    const group: EditableFieldGroup = {
      id: "g1",
      label: "Coordinators",
      attributes: [
        { attribute: "name", fieldKey: "coordinator", columnId: 101 },
        { attribute: "email", fieldKey: "coordinator_email", columnId: 102 },
      ],
    };
    const result = parseMultiPersonRow(row, group);
    expect(result).toEqual([
      { name: "lisa lujan", email: "llujan@wsu.edu", phone: "", campus: "" },
      { name: "deb marsh", email: "marshdj@wsu.edu", phone: "", campus: "" },
    ]);
  });

  it("returns no persons when all values empty so the role can stay cleared", () => {
    const row = makeRow({
      coordinator: { textValue: "" },
      coordinator_email: { textValue: "" },
    });
    const group: EditableFieldGroup = {
      id: "g1",
      label: "Coordinators",
      attributes: [
        { attribute: "name", fieldKey: "coordinator", columnId: 101 },
        { attribute: "email", fieldKey: "coordinator_email", columnId: 102 },
      ],
    };
    const result = parseMultiPersonRow(row, group);
    expect(result).toEqual([]);
  });

  it("aligns names and emails when values are newline-separated (stacked list)", () => {
    const row: ResolvedViewRow = {
      id: 1,
      fields: [],
      fieldMap: {
        c: {
          key: "c",
          label: "c",
          renderType: "text",
          textValue: "test\ntest2",
          listValue: [],
          links: [],
          isEmpty: false,
          hideWhenEmpty: false,
        },
        e: {
          key: "e",
          label: "e",
          renderType: "text",
          textValue: "a@x.com\nb@y.com",
          listValue: [],
          links: [],
          isEmpty: false,
          hideWhenEmpty: false,
        },
      },
    };
    const group: EditableFieldGroup = {
      id: "g",
      label: "G",
      attributes: [
        { attribute: "name", fieldKey: "c", columnId: 1 },
        { attribute: "email", fieldKey: "e", columnId: 2 },
      ],
    };
    expect(parseMultiPersonRow(row, group)).toEqual([
      { name: "test", email: "a@x.com", phone: "", campus: "" },
      { name: "test2", email: "b@y.com", phone: "", campus: "" },
    ]);
  });

  it("prefers listValue for each column when present", () => {
    const row: ResolvedViewRow = {
      id: 1,
      fields: [],
      fieldMap: {
        c: {
          key: "c",
          label: "c",
          renderType: "text",
          textValue: "joined-wrong",
          listValue: ["test", "test2"],
          links: [],
          isEmpty: false,
          hideWhenEmpty: false,
        },
        e: {
          key: "e",
          label: "e",
          renderType: "text",
          textValue: "joined-wrong",
          listValue: ["a@x.com", "b@y.com"],
          links: [],
          isEmpty: false,
          hideWhenEmpty: false,
        },
      },
    };
    const group: EditableFieldGroup = {
      id: "g",
      label: "G",
      attributes: [
        { attribute: "name", fieldKey: "c", columnId: 1 },
        { attribute: "email", fieldKey: "e", columnId: 2 },
      ],
    };
    expect(parseMultiPersonRow(row, group)).toEqual([
      { name: "test", email: "a@x.com", phone: "", campus: "" },
      { name: "test2", email: "b@y.com", phone: "", campus: "" },
    ]);
  });

  it("ignores name/email on role rows marked isEmpty so unused slots do not require fields", () => {
    const row: ResolvedViewRow = {
      id: 1,
      fields: [],
      fieldMap: {
        staff: {
          key: "staff",
          label: "Staff",
          renderType: "people_group",
          textValue: "",
          listValue: [],
          links: [],
          isEmpty: false,
          hideWhenEmpty: false,
          people: [
            { slot: "1", name: "Alice", email: "a@wsu.edu", isEmpty: false },
            {
              slot: "2",
              name: "should-not-appear",
              email: "ghost@wsu.edu",
              isEmpty: true,
            },
            { slot: "3", isEmpty: true },
          ],
        },
      },
    };
    const group: EditableFieldGroup = {
      id: "x",
      label: "Coordinators",
      fromRoleGroupViewFieldKey: "staff",
      usesFixedSlots: true,
      attributes: [
        { attribute: "name", fieldKey: "staff", columnId: 1, slot: "1" },
        { attribute: "email", fieldKey: "staff", columnId: 2, slot: "1" },
        { attribute: "name", fieldKey: "staff", columnId: 3, slot: "2" },
        { attribute: "email", fieldKey: "staff", columnId: 4, slot: "2" },
        { attribute: "name", fieldKey: "staff", columnId: 5, slot: "3" },
        { attribute: "email", fieldKey: "staff", columnId: 6, slot: "3" },
      ],
    };
    const persons = parseMultiPersonRow(row, group);
    expect(persons[1]).toEqual({ name: "", email: "", phone: "", campus: "" });
    expect(
      hasMultiPersonValidationErrors(validateMultiPersonGroupsForSave([group], { x: persons })),
    ).toBe(false);
  });
});

describe("serializeMultiPersonToCells", () => {
  it("joins with comma and space", () => {
    const persons: MultiPersonEntry[] = [
      { name: "lisa lujan", email: "llujan@wsu.edu", phone: "", campus: "" },
      { name: "deb marsh", email: "marshdj@wsu.edu", phone: "", campus: "" },
    ];
    const group: EditableFieldGroup = {
      id: "g1",
      label: "Coordinators",
      attributes: [
        { attribute: "name", fieldKey: "coordinator", columnId: 101 },
        { attribute: "email", fieldKey: "coordinator_email", columnId: 102 },
      ],
    };
    const result = serializeMultiPersonToCells(persons, group);
    expect(result).toEqual([
      { columnId: 101, value: "lisa lujan, deb marsh" },
      { columnId: 102, value: "llujan@wsu.edu, marshdj@wsu.edu" },
    ]);
  });

  it("round-trips with parseMultiPersonRow", () => {
    const original = "lisa lujan, deb marsh";
    const parsed = parseMultiPersonValue(original);
    const persons: MultiPersonEntry[] = parsed.map((name) => ({ name, email: "", phone: "", campus: "" }));
    const group: EditableFieldGroup = {
      id: "g1",
      label: "Coordinators",
      attributes: [{ attribute: "name", fieldKey: "coordinator", columnId: 101 }],
    };
    const cells = serializeMultiPersonToCells(persons, group);
    expect(cells[0]?.value).toBe("lisa lujan, deb marsh");
  });

  it("clears all columns when persons list is empty", () => {
    const group: EditableFieldGroup = {
      id: "g1",
      label: "Coordinators",
      attributes: [
        { attribute: "name", fieldKey: "coordinator", columnId: 101 },
        { attribute: "email", fieldKey: "coordinator_email", columnId: 102 },
      ],
    };
    const result = serializeMultiPersonToCells([], group);
    expect(result).toEqual([
      { columnId: 101, value: "" },
      { columnId: 102, value: "" },
    ]);
  });

  it("drops blank person slots when serializing contacts", () => {
    const group: EditableFieldGroup = {
      id: "g1",
      label: "Coordinators",
      attributes: [
        { attribute: "name", fieldKey: "coordinator", columnId: 101 },
        { attribute: "email", fieldKey: "coordinator_email", columnId: 102, columnType: "CONTACT_LIST" },
      ],
    };
    const persons: MultiPersonEntry[] = [
      { name: "", email: "", phone: "", campus: "" },
      { name: "Ada", email: "ada@wsu.edu", phone: "", campus: "" },
    ];
    const result = serializeMultiPersonToCells(persons, group);
    expect(result).toEqual([
      { columnId: 102, objectValue: { objectType: "CONTACT", email: "ada@wsu.edu" } },
      { columnId: 101, value: "Ada" },
    ]);
  });

  it("clears CONTACT_LIST with value when no contacts remain", () => {
    const group: EditableFieldGroup = {
      id: "g1",
      label: "Lead",
      attributes: [{ attribute: "email", fieldKey: "lead_email", columnId: 102, columnType: "CONTACT_LIST" }],
    };
    expect(serializeMultiPersonToCells([], group)).toEqual([{ columnId: 102, value: "" }]);
  });

  it("clears MULTI_CONTACT_LIST with value empty string when no contacts remain (error 1012 rejects empty values array)", () => {
    const group: EditableFieldGroup = {
      id: "g1",
      label: "Coordinators",
      attributes: [
        {
          attribute: "email",
          fieldKey: "coord_email",
          columnId: 201,
          columnType: "MULTI_CONTACT_LIST",
        },
      ],
    };
    expect(serializeMultiPersonToCells([], group)).toEqual([
      { columnId: 201, value: "" },
    ]);
  });

  it("serializes MULTI_CONTACT_LIST with contacts as objectValue values array", () => {
    const group: EditableFieldGroup = {
      id: "g1",
      label: "Coordinators",
      attributes: [
        {
          attribute: "email",
          fieldKey: "coord_email",
          columnId: 201,
          columnType: "MULTI_CONTACT_LIST",
        },
      ],
    };
    const persons: MultiPersonEntry[] = [
      { name: "", email: "alice@wsu.edu", phone: "", campus: "" },
      { name: "", email: "bob@wsu.edu", phone: "", campus: "" },
    ];
    expect(serializeMultiPersonToCells(persons, group)).toEqual([
      {
        columnId: 201,
        objectValue: {
          objectType: "MULTI_CONTACT",
          values: [
            { objectType: "CONTACT", email: "alice@wsu.edu" },
            { objectType: "CONTACT", email: "bob@wsu.edu" },
          ],
        },
      },
    ]);
  });

  it("merges fixed-slot name and email on the same CONTACT_LIST column into one cell", () => {
    const group: EditableFieldGroup = {
      id: "g-slot",
      label: "Coordinator",
      usesFixedSlots: true,
      fromRoleGroupViewFieldKey: "people",
      attributes: [
        { attribute: "name", fieldKey: "people", columnId: 500, columnType: "CONTACT_LIST", slot: "1" },
        { attribute: "email", fieldKey: "people", columnId: 500, columnType: "CONTACT_LIST", slot: "1" },
      ],
    };
    const persons: MultiPersonEntry[] = [{ name: "Ada Lovelace", email: "ada@example.com", phone: "", campus: "" }];
    expect(serializeMultiPersonToCells(persons, group)).toEqual([
      {
        columnId: 500,
        objectValue: { objectType: "CONTACT", name: "Ada Lovelace", email: "ada@example.com" },
      },
    ]);
  });

  it("merges fixed-slot name and email on the same MULTI_CONTACT_LIST column into one cell", () => {
    const group: EditableFieldGroup = {
      id: "g-slot",
      label: "Coordinator",
      usesFixedSlots: true,
      fromRoleGroupViewFieldKey: "people",
      attributes: [
        { attribute: "name", fieldKey: "people", columnId: 600, columnType: "MULTI_CONTACT_LIST", slot: "1" },
        { attribute: "email", fieldKey: "people", columnId: 600, columnType: "MULTI_CONTACT_LIST", slot: "1" },
      ],
    };
    const persons: MultiPersonEntry[] = [{ name: "Bob", email: "bob@example.com", phone: "", campus: "" }];
    expect(serializeMultiPersonToCells(persons, group)).toEqual([
      {
        columnId: 600,
        objectValue: {
          objectType: "MULTI_CONTACT",
          values: [{ objectType: "CONTACT", name: "Bob", email: "bob@example.com" }],
        },
      },
    ]);
  });

  it("writes per-slot campus picklist cells in fixed-slot groups", () => {
    const group: EditableFieldGroup = {
      id: "g",
      label: "Staff",
      usesFixedSlots: true,
      fromRoleGroupViewFieldKey: "staff",
      attributes: [
        { attribute: "name", fieldKey: "staff", columnId: 1, slot: "1", columnType: "TEXT_NUMBER" },
        { attribute: "campus", fieldKey: "staff", columnId: 2, slot: "1", columnType: "PICKLIST" },
      ],
    };
    const persons: MultiPersonEntry[] = [{ name: "Ada", email: "", phone: "", campus: "Pullman" }];
    expect(serializeMultiPersonToCells(persons, group)).toEqual([
      { columnId: 1, value: "Ada" },
      { columnId: 2, value: "Pullman" },
    ]);
  });

  it("clears campus for contact-empty slots (no orphan campus without name/email/phone)", () => {
    const group: EditableFieldGroup = {
      id: "g",
      label: "Staff",
      usesFixedSlots: true,
      fromRoleGroupViewFieldKey: "staff",
      attributes: [
        { attribute: "name", fieldKey: "staff", columnId: 1, slot: "1", columnType: "TEXT_NUMBER" },
        { attribute: "campus", fieldKey: "staff", columnId: 2, slot: "1", columnType: "PICKLIST" },
        { attribute: "name", fieldKey: "staff", columnId: 3, slot: "2", columnType: "TEXT_NUMBER" },
        { attribute: "campus", fieldKey: "staff", columnId: 4, slot: "2", columnType: "PICKLIST" },
      ],
    };
    const persons: MultiPersonEntry[] = [
      { name: "Ada", email: "", phone: "", campus: "Pullman" },
      { name: "", email: "", phone: "", campus: "Spokane" },
    ];
    expect(serializeMultiPersonToCells(persons, group)).toEqual([
      { columnId: 1, value: "Ada" },
      { columnId: 2, value: "Pullman" },
      { columnId: 3, value: "" },
      { columnId: 4, value: "" },
    ]);
  });
});

describe("derived role-group contributor editing", () => {
  const contactColumn: SmartsheetColumn = {
    id: 900,
    index: 0,
    title: "Editors",
    type: "CONTACT_LIST",
  };

  it("derives fixed-slot editable groups from numbered role groups", () => {
    const sourceConfig: SourceConfig = {
      id: "grad-programs",
      label: "GRAD Programs",
      sourceType: "sheet",
      smartsheetId: 1,
      roleGroups: [
        {
          id: "staff",
          label: "Staff Coordinators",
          mode: "numbered_slots",
          slots: [
            {
              slot: "1",
              name: { columnId: 301, columnTitle: "Staff Coordinator 1" },
              email: { columnId: 302, columnTitle: "Staff Coordinator Email 1" },
            },
            {
              slot: "2",
              name: { columnId: 303, columnTitle: "Staff Coordinator 2" },
            },
          ],
        },
      ],
    };
    const view: ViewConfig = {
      id: "faculty",
      slug: "grad-programs",
      sourceId: "grad-programs",
      label: "Faculty",
      layout: "table",
      public: false,
      fields: [
        {
          key: "staffCoordinators",
          label: "Staff Coordinators",
          source: { kind: "role_group", roleGroupId: "staff" },
          render: { type: "people_group" },
        },
      ],
      editing: {
        enabled: true,
        contactColumnIds: [900],
        editableColumnIds: [],
      },
    };
    const columns: SmartsheetColumn[] = [
      contactColumn,
      { id: 301, index: 1, title: "Staff Coordinator 1", type: "TEXT_NUMBER" },
      { id: 302, index: 2, title: "Staff Coordinator Email 1", type: "TEXT_NUMBER" },
      { id: 303, index: 3, title: "Staff Coordinator 2", type: "TEXT_NUMBER" },
    ];

    const result = buildContributorEditingClientConfig(view, columns, sourceConfig);

    expect(result?.editableFields).toEqual([]);
    expect(result?.editableFieldGroups).toHaveLength(1);
    expect(result?.editableFieldGroups[0]).toMatchObject({
      label: "Staff Coordinators",
      fromRoleGroupViewFieldKey: "staffCoordinators",
      usesFixedSlots: true,
    });
    expect(result?.editableFieldGroups[0]?.attributes).toEqual([
      expect.objectContaining({ attribute: "name", columnId: 301, slot: "1" }),
      expect.objectContaining({ attribute: "email", columnId: 302, slot: "1" }),
      expect.objectContaining({ attribute: "name", columnId: 303, slot: "2" }),
    ]);
  });

  it("marks unsafe multi-attribute delimited role groups read-only and invalid as sole editable content", () => {
    const sourceConfig: SourceConfig = {
      id: "grad-programs",
      label: "GRAD Programs",
      sourceType: "sheet",
      smartsheetId: 1,
      roleGroups: [
        {
          id: "legacy",
          label: "Legacy Coordinators",
          mode: "delimited_parallel",
          delimited: {
            name: { source: { columnId: 401, columnTitle: "Coordinator" } },
            email: { source: { columnId: 402, columnTitle: "Coordinator Email" } },
          },
        },
      ],
    };
    const view: ViewConfig = {
      id: "faculty",
      slug: "grad-programs",
      sourceId: "grad-programs",
      label: "Faculty",
      layout: "table",
      public: false,
      fields: [
        {
          key: "legacyCoordinators",
          label: "Legacy Coordinators",
          source: { kind: "role_group", roleGroupId: "legacy" },
          render: { type: "people_group" },
        },
      ],
      editing: {
        enabled: true,
        contactColumnIds: [900],
        editableColumnIds: [],
      },
    };
    const columns: SmartsheetColumn[] = [
      contactColumn,
      { id: 401, index: 1, title: "Coordinator", type: "TEXT_NUMBER" },
      { id: 402, index: 2, title: "Coordinator Email", type: "TEXT_NUMBER" },
    ];

    const result = buildContributorEditingClientConfig(view, columns, sourceConfig);

    expect(result?.editableFieldGroups).toHaveLength(1);
    expect(result?.editableFieldGroups[0]).toMatchObject({
      readOnly: true,
      usesFixedSlots: false,
      fromRoleGroupViewFieldKey: "legacyCoordinators",
    });
    expect(getContributorEditingValidationErrors(view, columns, sourceConfig)).toContain(
      "Select at least one Editable Field (what contributors can edit), add a Multi-person field group, or include a writable role-group field. Contact columns only define who can edit, not what.",
    );
  });

  it("derives writable groups from trusted multi-attribute delimited role groups", () => {
    const sourceConfig: SourceConfig = {
      id: "grad-programs",
      label: "GRAD Programs",
      sourceType: "sheet",
      smartsheetId: 1,
      roleGroups: [
        {
          id: "legacy",
          label: "Legacy Coordinators",
          mode: "delimited_parallel",
          delimited: {
            name: { source: { columnId: 401, columnTitle: "Coordinator" } },
            email: { source: { columnId: 402, columnTitle: "Coordinator Email" } },
            trustPairing: true,
          },
        },
      ],
    };
    const view: ViewConfig = {
      id: "faculty",
      slug: "grad-programs",
      sourceId: "grad-programs",
      label: "Faculty",
      layout: "table",
      public: false,
      fields: [
        {
          key: "legacyCoordinators",
          label: "Legacy Coordinators",
          source: { kind: "role_group", roleGroupId: "legacy" },
          render: { type: "people_group" },
        },
      ],
      editing: {
        enabled: true,
        contactColumnIds: [900],
        editableColumnIds: [],
      },
    };
    const columns: SmartsheetColumn[] = [
      contactColumn,
      { id: 401, index: 1, title: "Coordinator", type: "TEXT_NUMBER" },
      { id: 402, index: 2, title: "Coordinator Email", type: "TEXT_NUMBER" },
    ];

    const result = buildContributorEditingClientConfig(view, columns, sourceConfig);

    expect(result?.editableFieldGroups).toHaveLength(1);
    expect(result?.editableFieldGroups[0]).toMatchObject({
      label: "Legacy Coordinators",
      fromRoleGroupViewFieldKey: "legacyCoordinators",
      usesFixedSlots: false,
    });
    expect(result?.editableFieldGroups[0]?.readOnly).toBeUndefined();
    expect(result?.editableFieldGroups[0]?.attributes).toEqual([
      expect.objectContaining({ attribute: "name", columnId: 401 }),
      expect.objectContaining({ attribute: "email", columnId: 402 }),
    ]);
    expect(getContributorEditingValidationErrors(view, columns, sourceConfig)).not.toContain(
      "Select at least one Editable Field (what contributors can edit), add a Multi-person field group, or include a writable role-group field. Contact columns only define who can edit, not what.",
    );
  });
});

describe("pruneStaleContributorColumnIds", () => {
  it("removes contact and editable column ids absent from the current schema", () => {
    const view: ViewConfig = {
      id: "v",
      slug: "v",
      sourceId: "s",
      label: "V",
      layout: "table",
      public: false,
      fields: [],
      editing: {
        enabled: true,
        contactColumnIds: [100, 999999],
        editableColumnIds: [200, 2953654070890372],
      },
    };
    const columns: SmartsheetColumn[] = [
      { id: 100, index: 0, title: "Contact", type: "CONTACT_LIST" },
      { id: 200, index: 1, title: "Campus", type: "PICKLIST" },
    ];
    const { view: next, pruned } = pruneStaleContributorColumnIds(view, columns);
    expect(pruned).toBe(true);
    expect(next.editing?.contactColumnIds).toEqual([100]);
    expect(next.editing?.editableColumnIds).toEqual([200]);
  });
});
