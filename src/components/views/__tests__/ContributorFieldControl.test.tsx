import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  ContributorSingleFieldControl,
  ContributorGroupFieldControl,
  ContributorReadOnlyField,
} from "@/components/views/contributor/ContributorFieldControl";
import type { ResolvedFieldValue, EditableFieldGroup } from "@/lib/config/types";
import type { ContributorEditableFieldDefinition, MultiPersonEntry } from "@/lib/contributor-utils";

describe("ContributorSingleFieldControl", () => {
  const mockField: ResolvedFieldValue = {
    key: "test",
    label: "Test Label",
    renderType: "text",
    textValue: "Value",
    listValue: ["Value"],
    links: [],
    isEmpty: false,
    hideWhenEmpty: false,
  };

  const mockDef: ContributorEditableFieldDefinition = {
    columnId: 1,
    columnType: "TEXT_NUMBER",
    fieldKey: "test",
    label: "Test Label",
    columnTitle: "Smartsheet Title",
    renderType: "text",
  };

  it("renders an input for text fields", () => {
    const html = renderToStaticMarkup(
      <ContributorSingleFieldControl
        field={mockField}
        editableDef={mockDef}
        value="Initial"
        onChange={() => {}}
      />
    );
    expect(html).toContain('value="Initial"');
    expect(html).toContain('Smartsheet Title');
  });

  it("renders a select for picklist fields", () => {
    const picklistDef: ContributorEditableFieldDefinition = {
      ...mockDef,
      columnType: "PICKLIST",
      options: ["A", "B"],
    };
    const html = renderToStaticMarkup(
      <ContributorSingleFieldControl
        field={mockField}
        editableDef={picklistDef}
        value="A"
        onChange={() => {}}
      />
    );
    expect(html).toContain('<select');
    expect(html).toContain('<option value="A" selected="">A</option>');
    expect(html).toContain('<option value="B">B</option>');
  });

  it("renders a textarea for multiline_text", () => {
    const multilineDef: ContributorEditableFieldDefinition = {
      ...mockDef,
      renderType: "multiline_text",
    };
    const html = renderToStaticMarkup(
      <ContributorSingleFieldControl
        field={mockField}
        editableDef={multilineDef}
        value="Multi\nline"
        onChange={() => {}}
      />
    );
    expect(html).toContain('<textarea');
    expect(html).toContain('Multi');
    expect(html).toContain('line');
  });

  it("checkboxes MULTI_PICKLIST with comma-joined value", () => {
    const multiDef: ContributorEditableFieldDefinition = {
      ...mockDef,
      columnType: "MULTI_PICKLIST",
      options: ["Pullman", "Spokane"],
    };
    const html = renderToStaticMarkup(
      <ContributorSingleFieldControl
        field={mockField}
        editableDef={multiDef}
        value="Pullman, Spokane"
        onChange={() => {}}
      />
    );
    expect(html).toContain("<fieldset");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Pullman");
    expect(html).toContain("Spokane");
    expect(html).toContain('checked=""');
  });

  it("CONTACT_LIST: text input and Clear this role type=button (does not submit form)", () => {
    const contactDef: ContributorEditableFieldDefinition = {
      ...mockDef,
      columnType: "CONTACT_LIST",
      contactDisplayMode: "email",
    };
    const html = renderToStaticMarkup(
      <ContributorSingleFieldControl
        field={mockField}
        editableDef={contactDef}
        value="a@wsu.edu"
        onChange={() => {}}
      />
    );
    expect(html).toContain("Clear this role");
    expect(html).toContain('type="button"');
    expect(html).toContain('value="a@wsu.edu"');
    expect(html).toContain("<input");
  });
});

describe("ContributorGroupFieldControl", () => {
  const mockGroup: EditableFieldGroup = {
    id: "group1",
    label: "Coordinators",
    attributes: [
      { attribute: "name", fieldKey: "n", columnId: 1, columnType: "TEXT_NUMBER", columnTitle: "Name" },
      { attribute: "email", fieldKey: "e", columnId: 2, columnType: "CONTACT_LIST", columnTitle: "Email" },
    ],
    usesFixedSlots: false,
  };

  const mockPersons: MultiPersonEntry[] = [
    { name: "User One", email: "one@wsu.edu", phone: "", campus: "" },
  ];

  it("renders fieldsets for each person", () => {
    const html = renderToStaticMarkup(
      <ContributorGroupFieldControl
        group={mockGroup}
        persons={mockPersons}
        onChange={() => {}}
      />
    );
    expect(html).toContain('User One');
    expect(html).toContain('one@wsu.edu');
    expect(html).toContain('Coordinators — person 1');
  });

  it("uses each numbered slot Smartsheet column title for labels (not slot 1 for every row)", () => {
    const twoSlotGroup: EditableFieldGroup = {
      id: "rg-chair",
      label: "Department Chair or School Director",
      usesFixedSlots: true,
      fromRoleGroupViewFieldKey: "chairs",
      attributes: [
        {
          attribute: "name",
          fieldKey: "chairs",
          columnId: 101,
          columnType: "TEXT_NUMBER",
          columnTitle: "Department Chair or School Director Name 1",
          slot: "1",
        },
        {
          attribute: "email",
          fieldKey: "chairs",
          columnId: 102,
          columnType: "CONTACT_LIST",
          columnTitle: "Department Chair or School Director Email 1",
          slot: "1",
        },
        {
          attribute: "name",
          fieldKey: "chairs",
          columnId: 201,
          columnType: "TEXT_NUMBER",
          columnTitle: "Department Chair or School Director Name 2",
          slot: "2",
        },
        {
          attribute: "email",
          fieldKey: "chairs",
          columnId: 202,
          columnType: "CONTACT_LIST",
          columnTitle: "Department Chair or School Director Email 2",
          slot: "2",
        },
      ],
    };
    const persons: MultiPersonEntry[] = [
      { name: "Alice", email: "a@wsu.edu", phone: "", campus: "" },
      { name: "Bob", email: "b@wsu.edu", phone: "", campus: "" },
    ];
    const html = renderToStaticMarkup(
      <ContributorGroupFieldControl group={twoSlotGroup} persons={persons} onChange={() => {}} />
    );
    expect(html).toContain("Department Chair or School Director Name 1");
    expect(html).toContain("Department Chair or School Director Name 2");
    expect(html).toContain("Department Chair or School Director Email 1");
    expect(html).toContain("Department Chair or School Director Email 2");
  });

  it("renders campus select beside name for fixed slots when both attributes exist", () => {
    const group: EditableFieldGroup = {
      id: "rg-staff",
      label: "Staff Coordinators",
      usesFixedSlots: true,
      fromRoleGroupViewFieldKey: "staff",
      attributes: [
        {
          attribute: "name",
          fieldKey: "staff",
          columnId: 101,
          columnType: "TEXT_NUMBER",
          columnTitle: "Staff Coordinator Name 1",
          slot: "1",
        },
        {
          attribute: "campus",
          fieldKey: "staff",
          columnId: 102,
          columnType: "PICKLIST",
          columnTitle: "Staff Coordinator Campus 1",
          slot: "1",
          options: ["Do Not Show", "Pullman", "Spokane"],
        },
      ],
    };
    const persons: MultiPersonEntry[] = [{ name: "Ada", email: "", phone: "", campus: "Pullman" }];
    const html = renderToStaticMarkup(
      <ContributorGroupFieldControl group={group} persons={persons} onChange={() => {}} />,
    );
    expect(html).toContain("flex-row flex-wrap items-end gap-x-3");
    expect(html).toContain('id="rg-staff-n-0"');
    expect(html).toContain('id="rg-staff-c-0"');
    expect(html).toContain("<select");
    expect(html).toContain("Staff Coordinator Campus 1");
  });

  it("renders standalone campus select when campus exists without name attribute on fixed slots", () => {
    const group: EditableFieldGroup = {
      id: "rg-campus-only",
      label: "Odd group",
      usesFixedSlots: true,
      attributes: [
        {
          attribute: "campus",
          fieldKey: "staff",
          columnId: 102,
          columnType: "PICKLIST",
          columnTitle: "Campus 1 only",
          slot: "1",
          options: ["Pullman"],
        },
      ],
    };
    const persons: MultiPersonEntry[] = [{ name: "", email: "", phone: "", campus: "" }];
    const html = renderToStaticMarkup(
      <ContributorGroupFieldControl group={group} persons={persons} onChange={() => {}} />,
    );
    expect(html).toContain("rg-campus-only-c-only-0");
    expect(html).not.toContain("rg-campus-only-n-0");
  });
});

describe("ContributorReadOnlyField", () => {
  const mockField: ResolvedFieldValue = {
    key: "ro",
    label: "Read Only",
    renderType: "text",
    textValue: "Fixed",
    listValue: ["Fixed"],
    links: [],
    isEmpty: false,
    hideWhenEmpty: false,
  };

  it("renders label and value using FieldValue", () => {
    const html = renderToStaticMarkup(
      <ContributorReadOnlyField field={mockField} />
    );
    expect(html).toContain('Read Only');
    expect(html).toContain('Fixed');
  });

  it("renders message when provided", () => {
    const html = renderToStaticMarkup(
      <ContributorReadOnlyField field={mockField} message="Info message" />
    );
    expect(html).toContain('Info message');
  });
});
