import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FieldValue } from "@/components/views/layouts/FieldValue";
import type { ResolvedFieldValue } from "@/lib/config/types";

function buildPeopleField(overrides?: Partial<ResolvedFieldValue>): ResolvedFieldValue {
  return {
    key: "staff",
    label: "Staff Graduate Program Coordinator",
    renderType: "people_group",
    textValue: "Lisa Lujan\nllujan@wsu.edu",
    listValue: ["Lisa Lujan\nllujan@wsu.edu"],
    links: [{ label: "llujan@wsu.edu", href: "mailto:llujan@wsu.edu" }],
    isEmpty: false,
    hideWhenEmpty: false,
    people: [
      {
        slot: "1",
        name: "Lisa Lujan",
        email: "llujan@wsu.edu",
        phone: "(509) 335-9542",
        isEmpty: false,
      },
      {
        slot: "2",
        name: "Deb Marsh",
        email: "marshdj@wsu.edu",
        isEmpty: false,
      },
    ],
    roleGroupReadOnly: false,
    listDisplay: "inline",
    peopleStyle: "plain",
    ...overrides,
  };
}

describe("FieldValue people_group", () => {
  it("renders grouped people inline by default", () => {
    const html = renderToStaticMarkup(<FieldValue field={buildPeopleField({ listDisplay: undefined })} />);

    expect(html).toContain("grid-cols-1");
    expect(html).toContain("sm:gap-x-6");
    expect(html).toContain("view-people-name");
    expect(html).not.toContain("rounded-2xl border");
    expect(html).not.toContain("space-y-3");
  });

  it("supports the stacked mode when explicitly requested", () => {
    const html = renderToStaticMarkup(<FieldValue field={buildPeopleField({ listDisplay: "stacked" })} />);

    expect(html).toContain("space-y-2");
    expect(html).not.toContain("flex flex-wrap gap-x-6 gap-y-2");
  });

  it("supports capsule styling when requested", () => {
    const html = renderToStaticMarkup(<FieldValue field={buildPeopleField({ peopleStyle: "capsule" })} />);

    expect(html).toContain("rounded-2xl border");
  });

  it("renders campus as a chip after the name when campus is approved and name exists (R5)", () => {
    const html = renderToStaticMarkup(
      <FieldValue
        field={buildPeopleField({
          people: [
            { slot: "1", name: "Ada", email: "a@wsu.edu", campus: "Pullman", isEmpty: false },
          ],
        })}
      />,
    );

    expect(html).toContain("Ada");
    expect(html).toContain("Pullman");
    expect(html).toContain("rounded-full");
  });

  it("does not render a campus chip when name is missing even if campus is approved", () => {
    const html = renderToStaticMarkup(
      <FieldValue
        field={buildPeopleField({
          people: [
            { slot: "1", email: "solo@wsu.edu", campus: "Pullman", isEmpty: false },
          ],
        })}
      />,
    );

    expect(html).toContain("solo@wsu.edu");
    expect(html).not.toContain("Pullman");
  });

  it("renders campus as plain em-dash suffix after name when plainValueLinks (print)", () => {
    const html = renderToStaticMarkup(
      <FieldValue
        plainValueLinks
        field={buildPeopleField({
          people: [
            { slot: "1", name: "Ada", email: "a@wsu.edu", campus: "Pullman", isEmpty: false },
          ],
        })}
      />,
    );

    expect(html).toContain("Ada");
    expect(html).toContain("\u2014");
    expect(html).toContain("Pullman");
    expect(html).not.toContain("rounded-full");
  });

  it("does not show campus suffix in print mode when name is missing", () => {
    const html = renderToStaticMarkup(
      <FieldValue
        plainValueLinks
        field={buildPeopleField({
          people: [{ slot: "1", email: "e@wsu.edu", campus: "Spokane", isEmpty: false }],
        })}
      />,
    );

    expect(html).toContain("e@wsu.edu");
    expect(html).not.toContain("Spokane");
  });
});
