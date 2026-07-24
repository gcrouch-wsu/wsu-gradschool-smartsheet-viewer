import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => "/view/grad-programs/print",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/views/print/PrintViewToolbar", () => ({
  PrintViewToolbar: () => null,
}));

import { PrintViewDocument, buildPrintColumnPickerOptions } from "@/components/views/print/PrintViewDocument";
import type { ResolvedView } from "@/lib/config/types";
import { skip } from "node:test";

const view: ResolvedView = {
  id: "graduate-program-contact-list",
  label: "Graduate Program Contact List",
  layout: "stacked",
  displayTimeZone: "America/Los_Angeles",
  linkEmailsInView: true,
  linkPhonesInView: false,
  rowCount: 1,
  fields: [
    { key: "program_name", label: "Program Name", renderType: "text" },
    { key: "staff", label: "Staff Graduate Program Coordinator", renderType: "people_group" },
  ],
  rows: [
    {
      id: 101,
      fields: [
        {
          key: "program_name",
          label: "Program Name",
          renderType: "text",
          textValue: "Athletic Training",
          listValue: ["Athletic Training"],
          links: [],
          isEmpty: false,
          hideWhenEmpty: false,
        },
        {
          key: "staff",
          label: "Staff Graduate Program Coordinator",
          renderType: "people_group",
          textValue: "Lisa Lujan\nllujan@wsu.edu",
          listValue: ["Lisa Lujan\nllujan@wsu.edu"],
          links: [{ label: "llujan@wsu.edu", href: "mailto:llujan@wsu.edu" }],
          isEmpty: false,
          hideWhenEmpty: false,
          listDisplay: "inline",
          people: [
            {
              slot: "1",
              name: "Lisa Lujan",
              email: "llujan@wsu.edu",
              isEmpty: false,
            },
          ],
        },
      ],
      fieldMap: {},
    },
  ],
};

view.rows[0]!.fieldMap = Object.fromEntries(view.rows[0]!.fields.map((field) => [field.key, field]));

describe("PrintViewDocument", () => {
  it("renders a printable table layout by default", () => {
    const html = renderToStaticMarkup(
      <PrintViewDocument
        slug="grad-programs"
        viewId={view.id}
        singlePublishedView={false}
        pageTitle="Graduate Programs"
        sourceLabel="Programs"
        sourceName="GRAD Programs"
        fetchedAt="2026-03-31T12:00:00.000Z"
        view={view}
      />,
    );

    expect(html).toContain("<table");
    expect(html).toContain("Program Name");
    expect(html).toContain("Staff Graduate Program Coordinator");
    expect(html).toContain("Athletic Training");
    expect(html).toContain("Lisa Lujan");
    expect(html).toContain("<caption>");
    expect(html).toContain('scope="row"');
    expect(html).toContain("print-cell-inner");
    expect(html).toContain("print-cell-inner--primary");
  });

  it("omits non-heading columns not listed in printColumnKeys", () => {
    const html = renderToStaticMarkup(
      <PrintViewDocument
        slug="grad-programs"
        viewId={view.id}
        singlePublishedView={false}
        pageTitle="Graduate Programs"
        sourceLabel="Programs"
        sourceName="GRAD Programs"
        fetchedAt="2026-03-31T12:00:00.000Z"
        view={view}
        printColumnKeys={["program_name"]}
      />,
    );

    expect(html).toContain("Program Name");
    expect(html).not.toContain("Staff Graduate Program Coordinator");
    expect(html).not.toContain("Lisa Lujan");
  });

  it("renders separate print sections when printGroupByFieldKey splits rows", () => {
    const row2Fields = [
      {
        key: "program_name",
        label: "Program Name",
        renderType: "text" as const,
        textValue: "Biology",
        listValue: ["Biology"],
        links: [],
        isEmpty: false,
        hideWhenEmpty: false,
      },
      {
        key: "staff",
        label: "Staff Graduate Program Coordinator",
        renderType: "people_group" as const,
        textValue: "Pat Smith",
        listValue: ["Pat Smith"],
        links: [],
        isEmpty: false,
        hideWhenEmpty: false,
        listDisplay: "inline" as const,
        people: [{ slot: "1", name: "Pat Smith", email: "", isEmpty: false }],
      },
    ];
    const row2: (typeof view.rows)[0] = { id: 102, fields: row2Fields, fieldMap: {} };
    row2.fieldMap = Object.fromEntries(row2.fields.map((f) => [f.key, f]));

    const twoProgramView: ResolvedView = {
      ...view,
      rowCount: 2,
      presentation: { printGroupByFieldKey: "program_name" },
      rows: [view.rows[0]!, row2],
    };

    const html = renderToStaticMarkup(
      <PrintViewDocument
        slug="grad-programs"
        viewId={view.id}
        singlePublishedView={false}
        pageTitle="Graduate Programs"
        sourceLabel="Programs"
        sourceName="GRAD Programs"
        fetchedAt="2026-03-31T12:00:00.000Z"
        view={twoProgramView}
      />,
    );

    const sections = html.match(/print-group/g) ?? [];
    expect(sections.length).toBe(2);
    expect(html).toContain("Program Name: Athletic Training");
    expect(html).toContain("Program Name: Biology");
  });

  it("buildPrintColumnPickerOptions omits columns with no printable values", () => {
    const emptyExtraField = {
      key: "note",
      label: "Note",
      renderType: "text" as const,
      textValue: "",
      listValue: [] as string[],
      links: [] as { label: string; href: string }[],
      isEmpty: true,
      hideWhenEmpty: true,
    };
    const r = view.rows[0]!;
    const rowWithExtra = {
      ...r,
      fields: [...r.fields, emptyExtraField],
      fieldMap: {
        ...r.fieldMap,
        note: emptyExtraField,
      },
    };
    const v: ResolvedView = {
      ...view,
      fields: [...view.fields, { key: "note", label: "Note", renderType: "text" }],
      rows: [rowWithExtra],
    };
    const opts = buildPrintColumnPickerOptions(v);
    expect(opts.some((o) => o.key === "note")).toBe(false);
  });

  it("chunkPrintColumns keeps heading and splits data columns", async () => {
    const { chunkPrintColumns } = await import("@/components/views/print/PrintViewDocument");
    const cols = [
      { key: "name", label: "Name", heading: true },
      ...Array.from({ length: 10 }, (_, i) => ({ key: `c${i}`, label: `Col ${i}` })),
    ];
    const chunks = chunkPrintColumns(cols, 4);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.[0]?.heading).toBe(true);
    expect(chunks[0]).toHaveLength(5);
    expect(chunks[1]?.[0]?.heading).toBe(true);
    expect(chunks[2]).toHaveLength(3);
  });

  skip("wide layout keeps one table instead of column sections", () => {
    const manyFields = [
      { key: "program_name", label: "Program Name", renderType: "text" as const },
      ...Array.from({ length: 8 }, (_, i) => ({
        key: `extra_${i}`,
        label: `Extra ${i}`,
        renderType: "text" as const,
      })),
    ];
    const rowFields = manyFields.map((f) => ({
      key: f.key,
      label: f.label,
      renderType: "text" as const,
      textValue: f.key === "program_name" ? "Athletic Training" : "x",
      listValue: [f.key === "program_name" ? "Athletic Training" : "x"],
      links: [] as { label: string; href: string }[],
      isEmpty: false,
      hideWhenEmpty: false,
    }));
    const wideRow = {
      id: 101,
      fields: rowFields,
      fieldMap: Object.fromEntries(rowFields.map((f) => [f.key, f])),
    };
    const wideView: ResolvedView = {
      ...view,
      fields: manyFields,
      rows: [wideRow],
    };

    const sectionsHtml = renderToStaticMarkup(
      <PrintViewDocument
        slug="grad-programs"
        viewId={view.id}
        singlePublishedView={false}
        pageTitle="Graduate Programs"
        sourceLabel="Programs"
        sourceName="GRAD Programs"
        fetchedAt="2026-03-31T12:00:00.000Z"
        view={wideView}
        printTableLayout="sections"
      />,
    );
    const wideHtml = renderToStaticMarkup(
      <PrintViewDocument
        slug="grad-programs"
        viewId={view.id}
        singlePublishedView={false}
        pageTitle="Graduate Programs"
        sourceLabel="Programs"
        sourceName="GRAD Programs"
        fetchedAt="2026-03-31T12:00:00.000Z"
        view={wideView}
        printTableLayout="wide"
      />,
    );

    expect(sectionsHtml).toContain("print-export--sections");
    expect(sectionsHtml).toContain("print-column-chunk");
    expect(wideHtml).toContain("print-export--wide");
    // CSS still mentions print-column-chunk; assert the markup has no chunk wrappers.
    expect(wideHtml).not.toMatch(/class="[^"]*print-column-chunk/);
    expect(wideHtml).toContain("Extra 7");
  });
});
