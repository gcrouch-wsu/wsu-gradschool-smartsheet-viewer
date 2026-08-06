import { describe, expect, it } from "vitest";
import {
  buildContactChangeCells,
  findStageContactFields,
  isValidContactEmail,
  isValidContactName,
} from "@/lib/forms/contact-change";

describe("contact-change helpers", () => {
  it("matches CHR name/email columns to CHR Approval stage", () => {
    const columns = [
      { id: 1, title: "CHR Name", type: "TEXT_NUMBER" },
      { id: 2, title: "CHR Email", type: "TEXT_NUMBER" },
      { id: 3, title: "Director Email", type: "TEXT_NUMBER" },
      { id: 4, title: "CHR Approval", type: "PICKLIST" },
    ];
    const cells = [
      { columnId: 1, value: "Pat Chair", displayValue: "Pat Chair" },
      { columnId: 2, value: "pat@wsu.edu", displayValue: "pat@wsu.edu" },
      { columnId: 3, value: "dir@wsu.edu", displayValue: "dir@wsu.edu" },
    ];
    const bundle = findStageContactFields(columns, cells, "CHR Approval");
    expect(bundle.fields.map((f) => f.columnTitle).sort()).toEqual(["CHR Email", "CHR Name"]);
    expect(bundle.currentEmail).toBe("pat@wsu.edu");
    expect(bundle.currentName).toBe("Pat Chair");
  });

  it("builds CONTACT objectValue writes", () => {
    const cells = buildContactChangeCells({
      fields: [{ columnId: 9, columnType: "CONTACT_LIST", kind: "contact" }],
      proposedName: "Alex New",
      proposedEmail: "alex@wsu.edu",
    });
    expect(cells).toEqual([
      {
        columnId: 9,
        objectValue: { objectType: "CONTACT", email: "alex@wsu.edu", name: "Alex New" },
      },
    ]);
  });

  it("validates name and email", () => {
    expect(isValidContactName("")).toMatch(/required/i);
    expect(isValidContactName("A")).toMatch(/full name/i);
    expect(isValidContactName("Alex New")).toBeNull();
    expect(isValidContactEmail("")).toMatch(/required/i);
    expect(isValidContactEmail("not-an-email")).toMatch(/valid/i);
    expect(isValidContactEmail("ok@wsu.edu", ["wsu.edu"])).toBeNull();
    expect(isValidContactEmail("ok@gmail.com", ["wsu.edu"])).toMatch(/must be from/i);
    expect(isValidContactEmail("ok@email.wsu.edu", ["wsu.edu"])).toMatch(/must be from/i);
  });
});
