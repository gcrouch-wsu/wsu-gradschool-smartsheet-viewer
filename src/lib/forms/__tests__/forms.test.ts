import { describe, expect, it } from "vitest";
import { hiddenColumnTitles, validateFormClient } from "@/lib/forms/form-ui";
import { validateSubmission } from "@/lib/forms/validation";
import type { SmartsheetColumn } from "@/lib/forms/types";
import { validateWebhookSecret } from "@/lib/forms/webhook-auth";

describe("forms validation", () => {
  it("requires non-optional fields", () => {
    const columns: SmartsheetColumn[] = [
      { id: 1, title: "Full Name", type: "TEXT_NUMBER", primary: true },
      { id: 2, title: "Email", type: "TEXT_NUMBER" },
    ];
    const result = validateSubmission(columns, {}, []);
    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("accepts valid wsu.edu email", () => {
    const columns: SmartsheetColumn[] = [
      { id: 1, title: "Full Name", type: "TEXT_NUMBER" },
      { id: 2, title: "Email", type: "TEXT_NUMBER" },
    ];
    const result = validateSubmission(columns, { "1": "Jane", "2": "jane@wsu.edu" }, []);
    expect(result.ok).toBe(true);
    expect(result.cells).toHaveLength(2);
  });
});

describe("form ui helpers", () => {
  it("hides conditional fields when trigger does not match", () => {
    const columns: SmartsheetColumn[] = [
      { id: 1, title: "Type", type: "PICKLIST", options: ["A", "B"] },
      { id: 2, title: "Extra", type: "TEXT_NUMBER" },
    ];
    const hidden = hiddenColumnTitles(columns, [{ whenColumn: "Type", equals: ["B"], showColumns: ["Extra"] }], {
      "1": "A",
    });
    expect(hidden.has("extra")).toBe(true);
  });

  it("client validation matches server rules for email domain", () => {
    const columns: SmartsheetColumn[] = [
      { id: 1, title: "Email", type: "TEXT_NUMBER" },
    ];
    const result = validateFormClient(columns, { "1": "jane@example.com" }, [], ["wsu.edu"]);
    expect(result.ok).toBe(false);
    expect(result.fieldErrors["1"]).toMatch(/wsu\.edu/);
  });
});

describe("webhook auth", () => {
  it("rejects missing secret when env is unset", () => {
    const request = new Request("http://localhost/api/forms/webhooks/smartsheet");
    expect(validateWebhookSecret(request)).toBe(false);
  });
});
