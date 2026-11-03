import { describe, expect, it } from "vitest";
import type { UserNotification } from "@/lib/workflows/notifications";
import { presentVisibleNotifications } from "@/lib/workflows/visible-notifications";

function notification(partial: Partial<UserNotification> & { href?: string; sheetId?: string }): UserNotification {
  return {
    id: partial.id ?? "n1",
    recipientEmail: "ada@wsu.edu",
    title: partial.title ?? "Alert",
    body: partial.body ?? "Changed",
    payload: {
      sheetId: partial.sheetId ?? "",
      rowId: partial.payload?.rowId ?? null,
      href: partial.href,
      fields: [],
      templateKind: "alert",
    },
    workflowId: null,
    runId: null,
    readAt: partial.readAt ?? null,
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
  };
}

const sources = [
  { id: "leave", sourceType: "sheet" as const, smartsheetId: 2105083792674692, formsEnabled: true },
  { id: "views-only", sourceType: "sheet" as const, smartsheetId: 42, formsEnabled: false },
  { id: "report", sourceType: "report" as const, smartsheetId: 99 },
];

describe("presentVisibleNotifications", () => {
  it("hides alerts whose sheet is not in the workspace", () => {
    const items = [
      notification({ id: "missing", href: "/forms/sheet?sheetId=999", sheetId: "999" }),
      notification({ id: "dead", href: "/forms/sheet?sheetId=2105083792674692", sheetId: "2105083792674692", payload: { sheetId: "2105083792674692", rowId: 7, fields: [], templateKind: "alert" } }),
    ];
    const visible = presentVisibleNotifications(items, sources, "staff");
    expect(visible.map((item) => item.id)).toEqual(["dead"]);
    expect(visible[0]?.payload.href).toBe("/admin/sources/leave/sheet?rowId=7");
  });

  it("hides student alerts for sheets they cannot open", () => {
    const items = [
      notification({ id: "staff-only", sheetId: "42", href: "/forms/sheet?sheetId=42" }),
      notification({ id: "portal", sheetId: "2105083792674692", href: "/forms/sheet?sheetId=2105083792674692", payload: { sheetId: "2105083792674692", rowId: 3, fields: [], templateKind: "alert" } }),
    ];
    const visible = presentVisibleNotifications(items, sources, "student");
    expect(visible.map((item) => item.id)).toEqual(["portal"]);
    expect(visible[0]?.payload.href).toBe("/student/2105083792674692/3");
  });

  it("keeps alerts that do not point at a sheet", () => {
    const items = [notification({ id: "note", href: undefined, sheetId: "" })];
    expect(presentVisibleNotifications(items, sources, "staff")).toHaveLength(1);
  });
});
