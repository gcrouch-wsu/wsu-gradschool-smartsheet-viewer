import { describe, expect, it } from "vitest";
import { applyViewFilters } from "@/lib/filters";
import type { SmartsheetRow } from "@/lib/config/types";
import { getWorkflowTemplate, WORKFLOW_TEMPLATES } from "@/lib/workflows/catalog";
import { mergeTemplate } from "@/lib/workflows/merge";
import { emailsFromContactCell, normalizeEmail } from "@/lib/workflows/recipients";
import { isRunnableTemplateKind } from "@/lib/workflows/types";
import { isWorkflowAuthorRole } from "@/lib/workflows/access";
import { rowMatchesConditions } from "@/lib/workflows/engine";
import { validateWorkflowInput } from "@/lib/workflows/store";

function row(value: string, columnId = 1): SmartsheetRow {
  return {
    id: 10,
    cellsById: {
      [columnId]: {
        columnId,
        columnTitle: "Start",
        columnType: "DATE",
        value,
        displayValue: value,
      },
    },
    cellsByTitle: {},
  };
}

describe("workflow catalog", () => {
  it("keeps only alert runnable", () => {
    expect(isRunnableTemplateKind("alert")).toBe(true);
    expect(isRunnableTemplateKind("move_row")).toBe(false);
    expect(WORKFLOW_TEMPLATES.filter((template) => template.runnable).map((template) => template.kind)).toEqual(["alert"]);
    expect(getWorkflowTemplate("alert")?.greatWays.length).toBeGreaterThan(0);
    expect(isWorkflowAuthorRole("coordinator")).toBe(true);
    expect(isWorkflowAuthorRole("admin")).toBe(true);
    expect(isWorkflowAuthorRole("approver")).toBe(false);
  });
});

describe("workflow filters and recipients", () => {
  it("matches future dates with is_after today", () => {
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const filters = [{ columnId: 1, op: "is_after" as const, value: "today" }];
    expect(applyViewFilters([row(future)], filters)).toHaveLength(1);
    expect(applyViewFilters([row("2000-01-01")], filters)).toHaveLength(0);
    expect(rowMatchesConditions(row(future), filters)).toBe(true);
  });

  it("reads emails from contact cells and merge tokens", () => {
    expect(normalizeEmail("  Ada@WSU.edu ")).toBe("ada@wsu.edu");
    expect(
      emailsFromContactCell({
        objectValue: { objectType: "CONTACT", email: "lead@wsu.edu", name: "Ada" },
      }),
    ).toEqual(["lead@wsu.edu"]);
    expect(mergeTemplate("Hello {{Status}}", [{ title: "Status", value: "At Risk" }])).toBe("Hello At Risk");
  });

  it("rejects enabling a later-plan template and empty alert recipients", () => {
    expect(
      validateWorkflowInput({
        sheetId: "1",
        name: "Move",
        enabled: true,
        templateKind: "move_row",
        createdByEmail: "a@wsu.edu",
        trigger: { event: "row_updated", delivery: "immediate" },
        conditions: [],
        action: { kind: "move_row" },
      }),
    ).toMatch(/later plan/i);
    expect(
      validateWorkflowInput({
        sheetId: "1",
        name: "Alert",
        enabled: true,
        templateKind: "alert",
        createdByEmail: "a@wsu.edu",
        trigger: { event: "row_updated", delivery: "immediate" },
        conditions: [],
        action: { kind: "in_app_notification", recipients: { userEmails: [] }, title: "Hi" },
      }),
    ).toMatch(/person or a Contact/i);
  });
});
