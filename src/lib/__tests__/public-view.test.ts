import { afterEach, describe, expect, it, vi } from "vitest";

import type { SmartsheetCell, SmartsheetDataset, SmartsheetRow, SourceConfig, ViewConfig } from "@/lib/config/types";

const storeMock = vi.hoisted(() => ({
  getPublicViewsBySlug: vi.fn(),
  getSourceConfigById: vi.fn(),
  listPublicPageSummaries: vi.fn(),
}));

const smartsheetMock = vi.hoisted(() => ({
  getSmartsheetDataset: vi.fn(),
}));

vi.mock("@/lib/config/store", () => storeMock);
vi.mock("@/lib/smartsheet", () => ({
  getSmartsheetDataset: smartsheetMock.getSmartsheetDataset,
  normalizeColumnKey: (value: string) => value.trim().toLowerCase(),
}));

import { collectSchemaDriftWarnings, collectSelectorsFromRoleGroup, loadPublicPage } from "@/lib/public-view";

function createCell(columnId: number, columnTitle: string, value: unknown): SmartsheetCell {
  return {
    columnId,
    columnTitle,
    columnType: "TEXT_NUMBER",
    value,
  };
}

function createContactCell(
  columnId: number,
  columnTitle: string,
  email: string,
  name: string,
): SmartsheetCell {
  return {
    columnId,
    columnTitle,
    columnType: "CONTACT_LIST",
    value: email,
    displayValue: name,
    objectValue: {
      objectType: "CONTACT",
      email,
      name,
    },
  };
}

function createRow(id: number, cells: SmartsheetCell[]): SmartsheetRow {
  return {
    id,
    cellsById: Object.fromEntries(cells.map((cell) => [cell.columnId, cell])),
    cellsByTitle: Object.fromEntries(cells.map((cell) => [cell.columnTitle.trim().toLowerCase(), cell])),
  };
}

function createDataset(columns: SmartsheetDataset["columns"], rows: SmartsheetRow[]): SmartsheetDataset {
  return {
    sourceType: "sheet",
    id: 7763577444192132,
    name: "GRAD Programs",
    columns,
    rows,
    fetchedAt: "2026-03-16T20:00:00.000Z",
  };
}

function createView(overrides: Partial<ViewConfig> = {}): ViewConfig {
  return {
    id: "faculty",
    slug: "graduate-program-contacts",
    sourceId: "grad-programs",
    label: "Faculty Contacts",
    layout: "table",
    public: true,
    fields: [],
    ...overrides,
  };
}

const sourceConfig: SourceConfig = {
  id: "grad-programs",
  label: "GRAD Programs",
  sourceType: "sheet",
  smartsheetId: 7763577444192132,
};

afterEach(() => {
  vi.restoreAllMocks();
  storeMock.getPublicViewsBySlug.mockReset();
  storeMock.getSourceConfigById.mockReset();
  storeMock.listPublicPageSummaries.mockReset();
  smartsheetMock.getSmartsheetDataset.mockReset();
});

describe("public view resolution", () => {
  it("prefers helper columns before fallback columns", async () => {
    storeMock.getPublicViewsBySlug.mockResolvedValue([
      createView({
        fields: [
          {
            key: "programName",
            label: "Program Name",
            source: {
              preferredColumnTitle: "Program Name Clean",
              fallbackColumnTitle: "Program Name",
            },
            render: { type: "text" },
          },
        ],
      }),
    ]);
    storeMock.getSourceConfigById.mockResolvedValue(sourceConfig);
    smartsheetMock.getSmartsheetDataset.mockResolvedValue(
      createDataset(
        [
          { id: 100, index: 0, title: "Program Name", type: "TEXT_NUMBER" },
          { id: 101, index: 1, title: "Program Name Clean", type: "TEXT_NUMBER" },
        ],
        [
          createRow(1, [
            createCell(100, "Program Name", "Raw Name"),
            createCell(101, "Program Name Clean", "Clean Name"),
          ]),
        ]
      )
    );

    const page = await loadPublicPage("graduate-program-contacts");

    expect(page?.views[0]?.rows[0]?.fieldMap.programName.textValue).toBe("Clean Name");
  });

  it("throws when a slug spans multiple sources", async () => {
    storeMock.getPublicViewsBySlug.mockResolvedValue([
      createView({ id: "view-a", sourceId: "grad-programs" }),
      createView({ id: "view-b", sourceId: "other-programs" }),
    ]);

    await expect(loadPublicPage("graduate-program-contacts")).rejects.toThrow(
      'Slug "graduate-program-contacts" is published for multiple sources',
    );
    expect(storeMock.getSourceConfigById).not.toHaveBeenCalled();
    expect(smartsheetMock.getSmartsheetDataset).not.toHaveBeenCalled();
  });

  it("logs schema drift when a view references missing columns", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    storeMock.getPublicViewsBySlug.mockResolvedValue([
      createView({
        fields: [
          {
            key: "missingField",
            label: "Missing Field",
            source: { columnTitle: "Missing Column" },
            render: { type: "text" },
          },
        ],
        filters: [{ columnTitle: "Missing Filter", op: "equals", value: "Active" }],
      }),
    ]);
    storeMock.getSourceConfigById.mockResolvedValue(sourceConfig);
    smartsheetMock.getSmartsheetDataset.mockResolvedValue(
      createDataset([{ id: 100, index: 0, title: "Program Name", type: "TEXT_NUMBER" }], [createRow(1, [createCell(100, "Program Name", "Biology")])])
    );

    await loadPublicPage("graduate-program-contacts");

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Schema drift for slug "graduate-program-contacts" view "faculty"')
    );
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('field "missingField"'));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('filter "Missing Filter"'));
  });

  it("keeps rendering when one field transform throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    storeMock.getPublicViewsBySlug.mockResolvedValue([
      createView({
        fields: [
          {
            key: "programName",
            label: "Program Name",
            source: { columnTitle: "Program Name" },
            render: { type: "text" },
          },
          {
            key: "brokenDate",
            label: "Broken Date",
            source: { columnTitle: "Broken Date" },
            transforms: [{ op: "format_date", dateStyle: "bogus" as never }],
            render: { type: "date" },
          },
        ],
      }),
    ]);
    storeMock.getSourceConfigById.mockResolvedValue(sourceConfig);
    smartsheetMock.getSmartsheetDataset.mockResolvedValue(
      createDataset(
        [
          { id: 100, index: 0, title: "Program Name", type: "TEXT_NUMBER" },
          { id: 101, index: 1, title: "Broken Date", type: "DATE" },
        ],
        [
          createRow(1, [
            createCell(100, "Program Name", "Biology"),
            createCell(101, "Broken Date", "2024-01-15"),
          ]),
        ]
      )
    );

    const page = await loadPublicPage("graduate-program-contacts");

    expect(page?.views[0]?.rows[0]?.fieldMap.programName.textValue).toBe("Biology");
    expect(page?.views[0]?.rows[0]?.fieldMap.brokenDate.isEmpty).toBe(true);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to resolve field "brokenDate"')
    );
  });

  it("reports partial schema drift for role groups when only some selectors disappear", () => {
    const warnings = collectSchemaDriftWarnings(
      createView({
        fields: [
          {
            key: "staffCoordinators",
            label: "Staff Coordinators",
            source: { kind: "role_group", roleGroupId: "staff" },
            render: { type: "people_group" },
          },
        ],
      }),
      [
        { id: 201, index: 0, title: "Staff Coordinator 1", type: "TEXT_NUMBER" },
        { id: 202, index: 1, title: "Staff Coordinator Email 1", type: "TEXT_NUMBER" },
        { id: 203, index: 2, title: "Staff Coordinator 2", type: "TEXT_NUMBER" },
      ],
      {
        ...sourceConfig,
        roleGroups: [
          {
            id: "staff",
            label: "Staff Coordinator",
            mode: "numbered_slots",
            slots: [
              {
                slot: "1",
                name: { columnId: 201, columnTitle: "Staff Coordinator 1" },
                email: { columnId: 202, columnTitle: "Staff Coordinator Email 1" },
              },
              {
                slot: "2",
                name: { columnId: 203, columnTitle: "Staff Coordinator 2" },
                email: { columnId: 204, columnTitle: "Staff Coordinator Email 2" },
              },
            ],
          },
        ],
      },
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('field "staffCoordinators"');
    expect(warnings[0]).toContain("missing source columns");
    expect(warnings[0]).toContain("Staff Coordinator Email 2");
  });

  it("reports schema drift when a numbered-slot campus selector is missing from the schema", () => {
    const warnings = collectSchemaDriftWarnings(
      createView({
        fields: [
          {
            key: "staffCoordinators",
            label: "Staff Coordinators",
            source: { kind: "role_group", roleGroupId: "staff" },
            render: { type: "people_group" },
          },
        ],
      }),
      [
        { id: 201, index: 0, title: "Staff Coordinator 1", type: "TEXT_NUMBER" },
        { id: 202, index: 1, title: "Staff Coordinator Email 1", type: "TEXT_NUMBER" },
      ],
      {
        ...sourceConfig,
        roleGroups: [
          {
            id: "staff",
            label: "Staff Coordinator",
            mode: "numbered_slots",
            slots: [
              {
                slot: "1",
                name: { columnId: 201, columnTitle: "Staff Coordinator 1" },
                email: { columnId: 202, columnTitle: "Staff Coordinator Email 1" },
                campus: { columnId: 299, columnTitle: "Staff Coordinator Campus 1" },
              },
            ],
          },
        ],
      },
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('field "staffCoordinators"');
    expect(warnings[0]).toContain("missing source columns");
    expect(warnings[0]).toContain("Staff Coordinator Campus 1");
  });

  it("includes campus selectors in collectSelectorsFromRoleGroup for numbered slots", () => {
    const selectors = collectSelectorsFromRoleGroup({
      id: "staff",
      label: "Staff",
      mode: "numbered_slots",
      slots: [
        {
          slot: "1",
          name: { columnId: 1, columnTitle: "N1" },
          campus: { columnId: 2, columnTitle: "C1" },
        },
      ],
    });
    expect(selectors.map((s) => s.columnId)).toEqual([1, 2]);
  });

  it("resolves numbered role groups into structured people and excludes empty slots from text output", async () => {
    storeMock.getPublicViewsBySlug.mockResolvedValue([
      createView({
        fields: [
          {
            key: "staffCoordinators",
            label: "Staff Coordinators",
            source: { kind: "role_group", roleGroupId: "staff" },
            render: { type: "people_group" },
          },
        ],
      }),
    ]);
    storeMock.getSourceConfigById.mockResolvedValue({
      ...sourceConfig,
      roleGroups: [
        {
          id: "staff",
          label: "Staff Coordinators",
          mode: "numbered_slots",
          slots: [
            {
              slot: "1",
              name: { columnId: 201, columnTitle: "Staff Coordinator 1" },
              email: { columnId: 202, columnTitle: "Staff Coordinator Email 1" },
            },
            {
              slot: "2",
              name: { columnId: 203, columnTitle: "Staff Coordinator 2" },
              email: { columnId: 204, columnTitle: "Staff Coordinator Email 2" },
            },
          ],
        },
      ],
    });
    smartsheetMock.getSmartsheetDataset.mockResolvedValue(
      createDataset(
        [
          { id: 201, index: 0, title: "Staff Coordinator 1", type: "TEXT_NUMBER" },
          { id: 202, index: 1, title: "Staff Coordinator Email 1", type: "TEXT_NUMBER" },
          { id: 203, index: 2, title: "Staff Coordinator 2", type: "TEXT_NUMBER" },
          { id: 204, index: 3, title: "Staff Coordinator Email 2", type: "TEXT_NUMBER" },
        ],
        [
          createRow(1, [
            createCell(201, "Staff Coordinator 1", "Lisa Lujan"),
            createCell(202, "Staff Coordinator Email 1", "llujan@wsu.edu"),
            createCell(203, "Staff Coordinator 2", ""),
            createCell(204, "Staff Coordinator Email 2", ""),
          ]),
        ],
      ),
    );

    const page = await loadPublicPage("graduate-program-contacts");
    const field = page?.views[0]?.rows[0]?.fieldMap.staffCoordinators;

    expect(field?.renderType).toBe("people_group");
    expect(field?.roleGroupReadOnly).toBe(false);
    expect(field?.people).toEqual([
      { slot: "1", name: "Lisa Lujan", email: "llujan@wsu.edu", isEmpty: false },
      { slot: "2", isEmpty: true },
    ]);
    expect(field?.textValue).toContain("Lisa Lujan");
    expect(field?.textValue).not.toContain("slot 2");
    expect(field?.listValue).toEqual(["Lisa Lujan\nllujan@wsu.edu"]);
  });

  it("resolves per-slot campus picklist text on numbered role groups", async () => {
    storeMock.getPublicViewsBySlug.mockResolvedValue([
      createView({
        fields: [
          {
            key: "staffCoordinators",
            label: "Staff Coordinators",
            source: { kind: "role_group", roleGroupId: "staff" },
            render: { type: "people_group" },
          },
        ],
      }),
    ]);
    storeMock.getSourceConfigById.mockResolvedValue({
      ...sourceConfig,
      roleGroups: [
        {
          id: "staff",
          label: "Staff Coordinators",
          mode: "numbered_slots",
          slots: [
            {
              slot: "1",
              name: { columnId: 201, columnTitle: "Staff Coordinator 1" },
              email: { columnId: 202, columnTitle: "Staff Coordinator Email 1" },
              campus: { columnId: 299, columnTitle: "Staff Coordinator Campus 1" },
            },
          ],
        },
      ],
    });
    smartsheetMock.getSmartsheetDataset.mockResolvedValue(
      createDataset(
        [
          { id: 201, index: 0, title: "Staff Coordinator 1", type: "TEXT_NUMBER" },
          { id: 202, index: 1, title: "Staff Coordinator Email 1", type: "TEXT_NUMBER" },
          { id: 299, index: 2, title: "Staff Coordinator Campus 1", type: "PICKLIST" },
        ],
        [
          createRow(1, [
            createCell(201, "Staff Coordinator 1", "Lisa Lujan"),
            createCell(202, "Staff Coordinator Email 1", "llujan@wsu.edu"),
            {
              columnId: 299,
              columnTitle: "Staff Coordinator Campus 1",
              columnType: "PICKLIST",
              value: "Pullman",
            },
          ]),
        ],
      ),
    );

    const page = await loadPublicPage("graduate-program-contacts");
    const field = page?.views[0]?.rows[0]?.fieldMap.staffCoordinators;

    expect(field?.people?.[0]).toMatchObject({
      slot: "1",
      name: "Lisa Lujan",
      email: "llujan@wsu.edu",
      campus: "Pullman",
      isEmpty: false,
    });
  });

  it("marks slot empty when only campus is filled but name, email, and phone are blank (R5)", async () => {
    storeMock.getPublicViewsBySlug.mockResolvedValue([
      createView({
        fields: [
          {
            key: "programName",
            label: "Program",
            source: { columnTitle: "Program Name" },
            render: { type: "text" },
          },
          {
            key: "staffCoordinators",
            label: "Staff Coordinators",
            source: { kind: "role_group", roleGroupId: "staff" },
            render: { type: "people_group" },
          },
        ],
      }),
    ]);
    storeMock.getSourceConfigById.mockResolvedValue({
      ...sourceConfig,
      roleGroups: [
        {
          id: "staff",
          label: "Staff Coordinators",
          mode: "numbered_slots",
          slots: [
            {
              slot: "1",
              name: { columnId: 201, columnTitle: "Staff Coordinator 1" },
              email: { columnId: 202, columnTitle: "Staff Coordinator Email 1" },
              campus: { columnId: 299, columnTitle: "Staff Coordinator Campus 1" },
            },
          ],
        },
      ],
    });
    smartsheetMock.getSmartsheetDataset.mockResolvedValue(
      createDataset(
        [
          { id: 100, index: 0, title: "Program Name", type: "TEXT_NUMBER" },
          { id: 201, index: 1, title: "Staff Coordinator 1", type: "TEXT_NUMBER" },
          { id: 202, index: 2, title: "Staff Coordinator Email 1", type: "TEXT_NUMBER" },
          { id: 299, index: 3, title: "Staff Coordinator Campus 1", type: "PICKLIST" },
        ],
        [
          createRow(1, [
            createCell(100, "Program Name", "Biology"),
            createCell(201, "Staff Coordinator 1", ""),
            createCell(202, "Staff Coordinator Email 1", ""),
            {
              columnId: 299,
              columnTitle: "Staff Coordinator Campus 1",
              columnType: "PICKLIST",
              value: "Pullman",
            },
          ]),
        ],
      ),
    );

    const page = await loadPublicPage("graduate-program-contacts");
    const field = page?.views[0]?.rows[0]?.fieldMap.staffCoordinators;

    expect(field?.people?.[0]).toMatchObject({
      slot: "1",
      isEmpty: true,
      campus: "Pullman",
    });
  });

  it("keeps campus values paired to each numbered slot (1→1, 2→2)", async () => {
    storeMock.getPublicViewsBySlug.mockResolvedValue([
      createView({
        fields: [
          {
            key: "staffCoordinators",
            label: "Staff Coordinators",
            source: { kind: "role_group", roleGroupId: "staff" },
            render: { type: "people_group" },
          },
        ],
      }),
    ]);
    storeMock.getSourceConfigById.mockResolvedValue({
      ...sourceConfig,
      roleGroups: [
        {
          id: "staff",
          label: "Staff Coordinators",
          mode: "numbered_slots",
          slots: [
            {
              slot: "1",
              name: { columnId: 201, columnTitle: "Name 1" },
              email: { columnId: 202, columnTitle: "Email 1" },
              campus: { columnId: 299, columnTitle: "Campus 1" },
            },
            {
              slot: "2",
              name: { columnId: 203, columnTitle: "Name 2" },
              email: { columnId: 204, columnTitle: "Email 2" },
              campus: { columnId: 300, columnTitle: "Campus 2" },
            },
          ],
        },
      ],
    });
    smartsheetMock.getSmartsheetDataset.mockResolvedValue(
      createDataset(
        [
          { id: 201, index: 0, title: "Name 1", type: "TEXT_NUMBER" },
          { id: 202, index: 1, title: "Email 1", type: "TEXT_NUMBER" },
          { id: 299, index: 2, title: "Campus 1", type: "PICKLIST" },
          { id: 203, index: 3, title: "Name 2", type: "TEXT_NUMBER" },
          { id: 204, index: 4, title: "Email 2", type: "TEXT_NUMBER" },
          { id: 300, index: 5, title: "Campus 2", type: "PICKLIST" },
        ],
        [
          createRow(1, [
            createCell(201, "Name 1", "Alice"),
            createCell(202, "Email 1", "a@wsu.edu"),
            {
              columnId: 299,
              columnTitle: "Campus 1",
              columnType: "PICKLIST",
              value: "Pullman",
            },
            createCell(203, "Name 2", "Bob"),
            createCell(204, "Email 2", "b@wsu.edu"),
            {
              columnId: 300,
              columnTitle: "Campus 2",
              columnType: "PICKLIST",
              value: "Spokane",
            },
          ]),
        ],
      ),
    );

    const page = await loadPublicPage("graduate-program-contacts");
    const people = page?.views[0]?.rows[0]?.fieldMap.staffCoordinators?.people;

    expect(people?.[0]).toMatchObject({ slot: "1", name: "Alice", campus: "Pullman", isEmpty: false });
    expect(people?.[1]).toMatchObject({ slot: "2", name: "Bob", campus: "Spokane", isEmpty: false });
  });

  it("extracts only email text from CONTACT_LIST role-group email slots", async () => {
    storeMock.getPublicViewsBySlug.mockResolvedValue([
      createView({
        fields: [
          {
            key: "staffCoordinators",
            label: "Staff Coordinators",
            source: { kind: "role_group", roleGroupId: "staff" },
            render: { type: "people_group" },
          },
        ],
      }),
    ]);
    storeMock.getSourceConfigById.mockResolvedValue({
      ...sourceConfig,
      roleGroups: [
        {
          id: "staff",
          label: "Staff Coordinators",
          mode: "numbered_slots",
          slots: [
            {
              slot: "1",
              name: { columnId: 201, columnTitle: "Staff Coordinator 1" },
              email: { columnId: 202, columnTitle: "Staff Coordinator Email 1", columnType: "CONTACT_LIST" },
              phone: { columnId: 203, columnTitle: "Staff Coordinator Phone 1" },
            },
          ],
        },
      ],
    });
    smartsheetMock.getSmartsheetDataset.mockResolvedValue(
      createDataset(
        [
          { id: 201, index: 0, title: "Staff Coordinator 1", type: "TEXT_NUMBER" },
          { id: 202, index: 1, title: "Staff Coordinator Email 1", type: "CONTACT_LIST" },
          { id: 203, index: 2, title: "Staff Coordinator Phone 1", type: "TEXT_NUMBER" },
        ],
        [
          createRow(1, [
            createCell(201, "Staff Coordinator 1", "Lisa Lujan"),
            createContactCell(202, "Staff Coordinator Email 1", "llujan@wsu.edu", "Lisa Lujan"),
            createCell(203, "Staff Coordinator Phone 1", "(509) 335-9542"),
          ]),
        ],
      ),
    );

    const page = await loadPublicPage("graduate-program-contacts");
    const field = page?.views[0]?.rows[0]?.fieldMap.staffCoordinators;

    expect(field?.people).toEqual([
      {
        slot: "1",
        name: "Lisa Lujan",
        email: "llujan@wsu.edu",
        phone: "(509) 335-9542",
        isEmpty: false,
      },
    ]);
    expect(field?.textValue).toBe("Lisa Lujan\nllujan@wsu.edu\n(509) 335-9542");
  });

  it("marks trusted multi-attribute delimited role groups writable at runtime", async () => {
    storeMock.getPublicViewsBySlug.mockResolvedValue([
      createView({
        fields: [
          {
            key: "legacyCoordinators",
            label: "Legacy Coordinators",
            source: { kind: "role_group", roleGroupId: "legacy" },
            render: { type: "people_group" },
          },
        ],
      }),
    ]);
    storeMock.getSourceConfigById.mockResolvedValue({
      ...sourceConfig,
      roleGroups: [
        {
          id: "legacy",
          label: "Legacy Coordinators",
          mode: "delimited_parallel",
          delimited: {
            name: { source: { columnId: 301, columnTitle: "Coordinator" } },
            email: { source: { columnId: 302, columnTitle: "Coordinator Email" } },
            trustPairing: true,
          },
        },
      ],
    });
    smartsheetMock.getSmartsheetDataset.mockResolvedValue(
      createDataset(
        [
          { id: 301, index: 0, title: "Coordinator", type: "TEXT_NUMBER" },
          { id: 302, index: 1, title: "Coordinator Email", type: "TEXT_NUMBER" },
        ],
        [
          createRow(1, [
            createCell(301, "Coordinator", "Bob Smith, Jane Doe"),
            createCell(302, "Coordinator Email", "smith@wsu.edu, doe@wsu.edu"),
          ]),
        ],
      ),
    );

    const page = await loadPublicPage("graduate-program-contacts");
    const field = page?.views[0]?.rows[0]?.fieldMap.legacyCoordinators;

    expect(field?.roleGroupReadOnly).toBe(false);
    expect(field?.people).toEqual([
      { slot: "1", name: "Bob Smith", email: "smith@wsu.edu", isEmpty: false },
      { slot: "2", name: "Jane Doe", email: "doe@wsu.edu", isEmpty: false },
    ]);
  });

  it("marks untrusted multi-attribute delimited role groups read-only at runtime", async () => {
    storeMock.getPublicViewsBySlug.mockResolvedValue([
      createView({
        fields: [
          {
            key: "legacyCoordinators",
            label: "Legacy Coordinators",
            source: { kind: "role_group", roleGroupId: "legacy" },
            render: { type: "people_group" },
          },
        ],
      }),
    ]);
    storeMock.getSourceConfigById.mockResolvedValue({
      ...sourceConfig,
      roleGroups: [
        {
          id: "legacy",
          label: "Legacy Coordinators",
          mode: "delimited_parallel",
          delimited: {
            name: { source: { columnId: 301, columnTitle: "Coordinator" } },
            email: { source: { columnId: 302, columnTitle: "Coordinator Email" } },
          },
        },
      ],
    });
    smartsheetMock.getSmartsheetDataset.mockResolvedValue(
      createDataset(
        [
          { id: 301, index: 0, title: "Coordinator", type: "TEXT_NUMBER" },
          { id: 302, index: 1, title: "Coordinator Email", type: "TEXT_NUMBER" },
        ],
        [
          createRow(1, [
            createCell(301, "Coordinator", "Bob Smith, Jane Doe"),
            createCell(302, "Coordinator Email", "smith@wsu.edu, doe@wsu.edu"),
          ]),
        ],
      ),
    );

    const page = await loadPublicPage("graduate-program-contacts");
    const field = page?.views[0]?.rows[0]?.fieldMap.legacyCoordinators;

    expect(field?.roleGroupReadOnly).toBe(true);
    expect(field?.people).toHaveLength(2);
  });

  it("merges rows by shared program and contact email when presentation.mergeProgramRowsBySharedEmail is set", async () => {
    storeMock.getPublicViewsBySlug.mockResolvedValue([
      createView({
        presentation: {
          mergeProgramRowsBySharedEmail: true,
          programGroupFieldKey: "programName",
          campusFieldKey: "campus",
          mergePeopleFieldKey: "staffCoordinators",
        },
        fields: [
          {
            key: "programName",
            label: "Program",
            source: { columnTitle: "Program" },
            render: { type: "text" },
          },
          {
            key: "campus",
            label: "Campus",
            source: { columnTitle: "Campus" },
            render: { type: "text" },
          },
          {
            key: "staffCoordinators",
            label: "Staff",
            source: { kind: "role_group", roleGroupId: "staff" },
            render: { type: "people_group" },
          },
        ],
      }),
    ]);
    storeMock.getSourceConfigById.mockResolvedValue({
      ...sourceConfig,
      roleGroups: [
        {
          id: "staff",
          label: "Staff",
          mode: "numbered_slots",
          slots: [
            {
              slot: "1",
              name: { columnId: 201, columnTitle: "Staff Name" },
              email: { columnId: 202, columnTitle: "Staff Email" },
            },
          ],
        },
      ],
    });
    smartsheetMock.getSmartsheetDataset.mockResolvedValue(
      createDataset(
        [
          { id: 100, index: 0, title: "Program", type: "TEXT_NUMBER" },
          { id: 101, index: 1, title: "Campus", type: "TEXT_NUMBER" },
          { id: 201, index: 2, title: "Staff Name", type: "TEXT_NUMBER" },
          { id: 202, index: 3, title: "Staff Email", type: "TEXT_NUMBER" },
        ],
        [
          createRow(1, [
            createCell(100, "Program", "Biology"),
            createCell(101, "Campus", "Pullman"),
            createCell(201, "Staff Name", "Alice A"),
            createCell(202, "Staff Email", "alice@wsu.edu"),
          ]),
          createRow(2, [
            createCell(100, "Program", "Biology"),
            createCell(101, "Campus", "Spokane"),
            createCell(201, "Staff Name", "Alice A"),
            createCell(202, "Staff Email", "alice@wsu.edu"),
          ]),
          createRow(3, [
            createCell(100, "Program", "Chemistry"),
            createCell(101, "Campus", "Pullman"),
            createCell(201, "Staff Name", "Bob B"),
            createCell(202, "Staff Email", "bob@wsu.edu"),
          ]),
        ],
      ),
    );

    const page = await loadPublicPage("graduate-program-contacts");
    const rows = page?.views[0]?.rows ?? [];
    expect(rows).toHaveLength(2);
    const mergedBio = rows.find((r) => r.fieldMap.programName?.textValue === "Biology");
    expect(mergedBio?.mergedSourceRowIds?.slice().sort((a, b) => Number(a) - Number(b))).toEqual([1, 2]);
    expect(mergedBio?.mergedCampuses?.slice().sort((a, b) => a.localeCompare(b, "en"))).toEqual(["Pullman", "Spokane"]);
    expect(mergedBio?.fieldMap.campus?.textValue).toContain("Pullman");
    expect(mergedBio?.fieldMap.campus?.textValue).toContain("Spokane");
  });

  it("strips campus from ResolvedView.fields and row.fields when hideCampusFieldInRecordDisplay is on, preserving fieldMap and mergedCampuses", async () => {
    storeMock.getPublicViewsBySlug.mockResolvedValue([
      createView({
        presentation: {
          mergeProgramRowsBySharedEmail: true,
          programGroupFieldKey: "programName",
          campusFieldKey: "campus",
          mergePeopleFieldKey: "staffCoordinators",
          hideCampusFieldInRecordDisplay: true,
        },
        fields: [
          {
            key: "programName",
            label: "Program",
            source: { columnTitle: "Program" },
            render: { type: "text" },
          },
          {
            key: "campus",
            label: "Campus",
            source: { columnTitle: "Campus" },
            render: { type: "text" },
          },
          {
            key: "staffCoordinators",
            label: "Staff",
            source: { kind: "role_group", roleGroupId: "staff" },
            render: { type: "people_group" },
          },
        ],
      }),
    ]);
    storeMock.getSourceConfigById.mockResolvedValue({
      ...sourceConfig,
      roleGroups: [
        {
          id: "staff",
          label: "Staff",
          mode: "numbered_slots",
          slots: [
            {
              slot: "1",
              name: { columnId: 201, columnTitle: "Staff Name" },
              email: { columnId: 202, columnTitle: "Staff Email" },
            },
          ],
        },
      ],
    });
    smartsheetMock.getSmartsheetDataset.mockResolvedValue(
      createDataset(
        [
          { id: 100, index: 0, title: "Program", type: "TEXT_NUMBER" },
          { id: 101, index: 1, title: "Campus", type: "TEXT_NUMBER" },
          { id: 201, index: 2, title: "Staff Name", type: "TEXT_NUMBER" },
          { id: 202, index: 3, title: "Staff Email", type: "TEXT_NUMBER" },
        ],
        [
          createRow(1, [
            createCell(100, "Program", "Biology"),
            createCell(101, "Campus", "Pullman"),
            createCell(201, "Staff Name", "Alice A"),
            createCell(202, "Staff Email", "alice@wsu.edu"),
          ]),
          createRow(2, [
            createCell(100, "Program", "Biology"),
            createCell(101, "Campus", "Spokane"),
            createCell(201, "Staff Name", "Alice A"),
            createCell(202, "Staff Email", "alice@wsu.edu"),
          ]),
        ],
      ),
    );

    const page = await loadPublicPage("graduate-program-contacts");
    const resolvedView = page?.views[0];
    const mergedRow = resolvedView?.rows[0];

    // ResolvedView.fields must not include the campus column (hidden from table/print headers)
    expect(resolvedView?.fields.some((f) => f.key === "campus")).toBe(false);

    // Row's .fields array must not include campus (hidden from card/table cell rendering)
    expect(mergedRow?.fields.some((f) => f.key === "campus")).toBe(false);

    // fieldMap retains campus for grouping, merge, and __campus_badges__ resolution
    expect(mergedRow?.fieldMap.campus).toBeDefined();

    // mergedCampuses is still populated for badge display
    expect(mergedRow?.mergedCampuses?.slice().sort((a, b) => a.localeCompare(b, "en"))).toEqual(["Pullman", "Spokane"]);
  });
});
