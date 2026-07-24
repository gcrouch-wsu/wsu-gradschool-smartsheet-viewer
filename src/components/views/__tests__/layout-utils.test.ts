import { describe, expect, it } from "vitest";
import {
  cardLayoutContinuationRowClass,
  cardLayoutIncludesCampusBadges,
  getCardLayoutRows,
  getContributorEditorAdditionalOnlyFieldKeys,
  getEditDrawerOrderedFields,
  resolvePublicVisibilityFieldKey,
  sortContributorEditorAdditionalFields,
  stripCardLayoutRowsForContributorMainEditor,
} from "@/components/views/layouts/layout-utils";
import type { CardLayoutCell } from "@/components/views/layouts/layout-utils";
import type { ContributorEditableFieldDefinition } from "@/lib/contributor-utils";
import { contributorResolvedFieldStub } from "@/lib/contributor-utils";
import { CARD_LAYOUT_CAMPUS_BADGES } from "@/lib/config/types";
import type { ResolvedFieldValue, ResolvedView, ResolvedViewRow } from "@/lib/config/types";

function textField(key: string, label: string, textValue: string, hideWhenEmpty = false): ResolvedFieldValue {
  return {
    key,
    label,
    renderType: "text",
    textValue,
    listValue: textValue ? [textValue] : [],
    links: [],
    isEmpty: !textValue,
    hideWhenEmpty,
  };
}

function makeView(overrides: Partial<ResolvedView> = {}): ResolvedView {
  return {
    id: "v",
    label: "V",
    layout: "cards",
    displayTimeZone: "America/Los_Angeles",
    linkEmailsInView: false,
    linkPhonesInView: false,
    rowCount: 1,
    fields: [],
    rows: [],
    ...overrides,
  };
}

function makeRow(fieldMap: Record<string, ResolvedFieldValue>, extra?: Partial<ResolvedViewRow>): ResolvedViewRow {
  return { id: 1, fields: Object.values(fieldMap), fieldMap, ...extra };
}

describe("cardLayoutContinuationRowClass", () => {
  function fieldCell(hideLabel: boolean): CardLayoutCell {
    return { type: "field", field: { ...textField("k", "Label", "v"), hideLabel } };
  }

  it("leaves first row unchanged", () => {
    expect(cardLayoutContinuationRowClass([fieldCell(true)], 0, "")).toBe("");
    expect(cardLayoutContinuationRowClass([fieldCell(true)], 0, "mt-4")).toBe("mt-4");
  });

  it("tightens spacing when a later row is a single hide-label field", () => {
    expect(cardLayoutContinuationRowClass([fieldCell(true)], 1, "mt-4 pt-4")).toBe("mt-1 border-t-0 pt-0");
  });

  it("keeps standard class when the row has more than one field", () => {
    expect(cardLayoutContinuationRowClass([fieldCell(true), fieldCell(false)], 1, "std")).toBe("std");
  });

  it("keeps standard class when the single field shows its label", () => {
    expect(cardLayoutContinuationRowClass([fieldCell(false)], 1, "std")).toBe("std");
  });
});

describe("cardLayoutIncludesCampusBadges", () => {
  it("is true when any layout row includes the campus badges token", () => {
    const view = makeView({
      presentation: {
        cardLayout: [{ fieldKeys: ["prog"] }, { fieldKeys: [CARD_LAYOUT_CAMPUS_BADGES] }],
      },
    });
    expect(cardLayoutIncludesCampusBadges(view)).toBe(true);
  });

  it("is false when layout has no token", () => {
    const view = makeView({
      presentation: { cardLayout: [{ fieldKeys: ["prog", "other"] }] },
    });
    expect(cardLayoutIncludesCampusBadges(view)).toBe(false);
  });
});

describe("getCardLayoutRows", () => {
  it("returns campus_badges cell populated from mergedCampuses", () => {
    const row = makeRow(
      { prog: textField("prog", "Program", "Biology") },
      { mergedCampuses: ["Pullman", "Spokane"] },
    );
    const view = makeView({
      presentation: {
        campusFieldKey: "campus",
        cardLayout: [{ fieldKeys: ["prog", CARD_LAYOUT_CAMPUS_BADGES] }],
      },
    });
    const rows = getCardLayoutRows(view, row);
    expect(rows).toHaveLength(1);
    const badgeCell = rows[0]?.find((c) => c.type === "campus_badges");
    expect(badgeCell?.type === "campus_badges" && badgeCell.campuses).toEqual(["Pullman", "Spokane"]);
  });

  it("drops a layout row whose only renderable content is an empty campus_badges token", () => {
    const row = makeRow({ prog: textField("prog", "Program", "Biology") });
    // No campusFieldKey → resolvedRowCampusBadgeLabels returns []
    const view = makeView({
      presentation: {
        cardLayout: [{ fieldKeys: [CARD_LAYOUT_CAMPUS_BADGES] }],
      },
    });
    const rows = getCardLayoutRows(view, row);
    expect(rows).toHaveLength(0);
  });

  it("keeps a layout row that has a field alongside an empty campus_badges token", () => {
    const row = makeRow({ prog: textField("prog", "Program", "Biology") });
    const view = makeView({
      presentation: {
        cardLayout: [{ fieldKeys: ["prog", CARD_LAYOUT_CAMPUS_BADGES] }],
      },
    });
    const rows = getCardLayoutRows(view, row);
    expect(rows).toHaveLength(1);
    const badgeCell = rows[0]?.find((c) => c.type === "campus_badges");
    expect(badgeCell?.type === "campus_badges" && badgeCell.campuses).toEqual([]);
  });

  it("renders hidden campus field key as placeholder when hideCampusFieldInRecordDisplay is on (public)", () => {
    const row = makeRow({
      prog: textField("prog", "Program", "Biology"),
      campus: textField("campus", "Campus", "Pullman"),
    });
    const view = makeView({
      presentation: {
        campusFieldKey: "campus",
        hideCampusFieldInRecordDisplay: true,
        cardLayout: [{ fieldKeys: ["prog", "campus"] }],
      },
    });
    const rows = getCardLayoutRows(view, row);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.map((c) => c.type)).toEqual(["field", "placeholder"]);
  });

  it("renders campus as a field for contributor layout when hideCampusFieldInRecordDisplay is on", () => {
    const row = makeRow({
      prog: textField("prog", "Program", "Biology"),
      campus: textField("campus", "Campus", "Pullman"),
    });
    const view = makeView({
      presentation: {
        campusFieldKey: "campus",
        hideCampusFieldInRecordDisplay: true,
        cardLayout: [{ fieldKeys: ["prog", "campus"] }],
      },
    });
    const ed = new Map<string, ContributorEditableFieldDefinition>([
      [
        "campus",
        {
          columnId: 99,
          columnType: "PICKLIST",
          fieldKey: "campus",
          label: "Campus",
          columnTitle: "Campus",
          renderType: "badge",
        },
      ],
    ]);
    const rows = getCardLayoutRows(view, row, {
      contributorFieldKeys: new Set(["campus"]),
      contributorEditableByKey: ed,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.map((c) => c.type)).toEqual(["field", "field"]);
    const campusCell = rows[0]?.[1];
    expect(campusCell?.type === "field" && campusCell.field.key).toBe("campus");
  });

  it("dedupes repeated field keys and campus badge rows when display row merges multiple sheet rows", () => {
    const row = makeRow(
      {
        program_name: textField("program_name", "Program", "Biology"),
        campus: textField("campus", "Campus", "Pullman; Spokane"),
        notes: textField("notes", "Notes", "Hello"),
      },
      { mergedSourceRowIds: [10, 20], mergedCampuses: ["Pullman", "Spokane"] },
    );
    const view = makeView({
      presentation: {
        campusFieldKey: "campus",
        cardLayout: [
          { fieldKeys: ["program_name", "campus"] },
          { fieldKeys: ["program_name", "notes"] },
        ],
      },
    });
    const rows = getCardLayoutRows(view, row);
    expect(rows).toHaveLength(2);
    const keysR0 = rows[0]?.filter((c) => c.type === "field").map((c) => (c.type === "field" ? c.field.key : ""));
    expect(keysR0).toEqual(["program_name", "campus"]);
    const keysR1 = rows[1]?.filter((c) => c.type === "field").map((c) => (c.type === "field" ? c.field.key : ""));
    expect(keysR1).toEqual(["notes"]);
    expect(rows[1]?.some((c) => c.type === "placeholder")).toBe(true);
  });

  it("renders campus as a field when hideCampusFieldInRecordDisplay is on and campus is only in contributorEditableByKey", () => {
    const row = makeRow({
      prog: textField("prog", "Program", "Biology"),
      campus: textField("campus", "Campus", "Pullman"),
    });
    const view = makeView({
      presentation: {
        campusFieldKey: "campus",
        hideCampusFieldInRecordDisplay: true,
        cardLayout: [{ fieldKeys: ["prog", "campus"] }],
      },
    });
    const ed = new Map<string, ContributorEditableFieldDefinition>([
      [
        "campus",
        {
          columnId: 99,
          columnType: "PICKLIST",
          fieldKey: "campus",
          label: "Campus",
          columnTitle: "Campus",
          renderType: "badge",
        },
      ],
    ]);
    const rows = getCardLayoutRows(view, row, {
      contributorFieldKeys: new Set(["prog"]),
      contributorEditableByKey: ed,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.map((c) => c.type)).toEqual(["field", "field"]);
  });
});

describe("getEditDrawerOrderedFields", () => {
  it("dedupes when the same field key appears in multiple cardLayout rows", () => {
    const row: ResolvedViewRow = {
      id: 1,
      fields: [],
      fieldMap: {
        program_name: textField("program_name", "Program", "Biology"),
        campus: textField("campus", "Campus", "Pullman"),
      },
    };
    row.fields = Object.values(row.fieldMap);

    const view: ResolvedView = {
      id: "v1",
      label: "View",
      layout: "stacked",
      displayTimeZone: "America/Los_Angeles",
      linkEmailsInView: true,
      linkPhonesInView: false,
      rowCount: 1,
      fields: [
        { key: "program_name", label: "Program", renderType: "text" },
        { key: "campus", label: "Campus", renderType: "text" },
      ],
      presentation: {
        cardLayout: [
          { fieldKeys: ["program_name", "campus"] },
          { fieldKeys: ["program_name"] },
        ],
      },
      rows: [row],
    };

    const ordered = getEditDrawerOrderedFields(view, row, new Set(["program_name", "campus"]));
    expect(ordered.map((f) => f.key)).toEqual(["program_name", "campus"]);
  });

  it("includes a contributor-only field via editable map when ResolvedView.fields omits that key", () => {
    const campusEd: ContributorEditableFieldDefinition = {
      columnId: 9,
      columnType: "PICKLIST",
      fieldKey: "campus",
      label: "Campus",
      columnTitle: "Grad Campus",
      renderType: "badge",
      options: ["Pullman"],
    };
    const editableMap = new Map<string, ContributorEditableFieldDefinition>([["campus", campusEd]]);

    const row = makeRow({ program_name: textField("program_name", "Program", "Bio") });
    const view = makeView({
      fields: [{ key: "program_name", label: "Program", renderType: "text" }],
      presentation: { cardLayout: [{ fieldKeys: ["program_name", "campus"] }] },
    });

    const ordered = getEditDrawerOrderedFields(view, row, new Set(["program_name", "campus"]), editableMap);
    expect(ordered.map((f) => f.key)).toEqual(["program_name", "campus"]);
    const campusField = ordered.find((f) => f.key === "campus");
    expect(campusField).toEqual(contributorResolvedFieldStub(campusEd));
  });

  it("appends contributor field by stub when key is missing from row.fieldMap and ResolvedView.fields (e.g. hidden column)", () => {
    const pubEd: ContributorEditableFieldDefinition = {
      columnId: 12,
      columnType: "PICKLIST",
      fieldKey: "public_visibility",
      label: "Public Visibility",
      columnTitle: "Public Visibility",
      renderType: "badge",
      options: ["Show", "Hide"],
    };
    const editableMap = new Map<string, ContributorEditableFieldDefinition>([["public_visibility", pubEd]]);

    const row = makeRow({ program_name: textField("program_name", "Program", "Bio") });
    const view = makeView({
      fields: [{ key: "program_name", label: "Program", renderType: "text" }],
      presentation: { cardLayout: [{ fieldKeys: ["program_name"] }] },
    });

    const ordered = getEditDrawerOrderedFields(view, row, new Set(["program_name"]), editableMap);
    expect(ordered.map((f) => f.key)).toEqual(["program_name", "public_visibility"]);
    expect(ordered.find((f) => f.key === "public_visibility")).toEqual(contributorResolvedFieldStub(pubEd));
  });

  it("includes empty hideWhenEmpty contributor field when admin marked editable", () => {
    const ed: ContributorEditableFieldDefinition = {
      columnId: 3,
      columnType: "PICKLIST",
      fieldKey: "pub",
      label: "Public",
      columnTitle: "Public",
      renderType: "badge",
    };
    const editableMap = new Map<string, ContributorEditableFieldDefinition>([["pub", ed]]);
    const row = makeRow({
      program_name: textField("program_name", "Program", "Bio"),
      pub: {
        key: "pub",
        label: "Public",
        renderType: "badge",
        textValue: "",
        listValue: [],
        links: [],
        isEmpty: true,
        hideWhenEmpty: true,
      },
    });
    const view = makeView({
      fields: [
        { key: "program_name", label: "Program", renderType: "text" },
        { key: "pub", label: "Public", renderType: "badge" },
      ],
      presentation: { cardLayout: [{ fieldKeys: ["program_name", "pub"] }] },
    });

    const ordered = getEditDrawerOrderedFields(view, row, new Set(["program_name", "pub"]), editableMap);
    expect(ordered.map((f) => f.key)).toContain("pub");
  });
});

describe("contributor editor campus / visibility zoning", () => {
  it("additional-only keys include presentation campusFieldKey and Public Visibility field", () => {
    const view = makeView({
      fields: [
        { key: "program_name", label: "Program", renderType: "text" },
        { key: "grad_campus", label: "Campus", renderType: "badge" },
        { key: "public_visibility", label: "Public Visibility", renderType: "badge" },
      ],
      presentation: { campusFieldKey: "grad_campus" },
    });
    expect([...getContributorEditorAdditionalOnlyFieldKeys(view)].sort()).toEqual(["grad_campus", "public_visibility"]);
  });

  it("resolvePublicVisibilityFieldKey falls back to public_visibility key", () => {
    const view = makeView({
      fields: [{ key: "public_visibility", label: "Other label", renderType: "badge" }],
    });
    expect(resolvePublicVisibilityFieldKey(view)).toBe("public_visibility");
  });

  it("stripCardLayoutRowsForContributorMainEditor removes campus field row and campus_badges row", () => {
    const row = makeRow(
      {
        program_name: textField("program_name", "Program", "Bio"),
        campus: textField("campus", "Campus", "Pullman"),
      },
      { mergedCampuses: ["Pullman"] },
    );
    const view = makeView({
      presentation: {
        campusFieldKey: "campus",
        cardLayout: [{ fieldKeys: ["program_name", "campus"] }, { fieldKeys: [CARD_LAYOUT_CAMPUS_BADGES] }],
      },
    });
    const rows = getCardLayoutRows(view, row);
    const stripped = stripCardLayoutRowsForContributorMainEditor(rows, new Set(["campus"]), "campus");
    expect(stripped).toHaveLength(1);
    expect(stripped[0]?.map((c) => c.type)).toEqual(["field", "placeholder"]);
  });

  it("sortContributorEditorAdditionalFields orders campus before public visibility", () => {
    const view = makeView({
      fields: [
        { key: "campus", label: "Campus", renderType: "badge" },
        { key: "public_visibility", label: "Public Visibility", renderType: "badge" },
      ],
      presentation: { campusFieldKey: "campus" },
    });
    const sorted = sortContributorEditorAdditionalFields(
      [textField("public_visibility", "Public Visibility", "Show"), textField("campus", "Campus", "P")],
      view,
    );
    expect(sorted.map((f) => f.key)).toEqual(["campus", "public_visibility"]);
  });
});
