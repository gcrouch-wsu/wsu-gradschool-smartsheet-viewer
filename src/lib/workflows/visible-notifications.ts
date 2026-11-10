import type { SourceConfig } from "@/lib/config/types";
import type { UserNotification } from "@/lib/workflows/notifications";

export type NotificationAudience = "staff" | "student";

type SheetSource = Pick<SourceConfig, "id" | "sourceType" | "smartsheetId" | "formsEnabled" | "studentVisible">;

/** A sheet the signed-in person can open. Reports and unknown ids are not visible pages. */
function isOpenableSheet(source: SheetSource, audience: NotificationAudience): boolean {
  if (source.sourceType !== "sheet" || !Number.isFinite(source.smartsheetId) || source.smartsheetId === 0) {
    return false;
  }
  if (audience === "staff") return true;
  return source.formsEnabled !== false || source.studentVisible === true;
}

function readTarget(item: UserNotification): { sheetId: string; sourceId: string; deadPath: boolean } {
  const payloadSheet = String(item.payload?.sheetId ?? "").trim();
  const href = item.payload?.href?.trim() ?? "";
  let sheetId = payloadSheet;
  let sourceId = "";
  let deadPath = false;
  if (!href.startsWith("/")) {
    return { sheetId, sourceId, deadPath };
  }
  try {
    const url = new URL(href, "http://localhost");
    const fromQuery = url.searchParams.get("sheetId")?.trim() ?? "";
    if (!sheetId && fromQuery) sheetId = fromQuery;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "admin" && parts[1] === "sources" && parts[2] && parts[3] === "sheet") {
      sourceId = decodeURIComponent(parts[2]);
    }
    if (parts[0] === "student" && parts[1] && !sheetId) {
      sheetId = decodeURIComponent(parts[1]);
    }
    if (parts[0] === "forms" && (parts[1] === "sheet" || parts[1] === "builder" || parts[1] === "manage")) {
      deadPath = true;
    }
  } catch {
    deadPath = href.startsWith("/forms/sheet") || href.startsWith("/forms/builder") || href.startsWith("/forms/manage");
  }
  return { sheetId, sourceId, deadPath };
}

export function notificationHref(
  source: Pick<SourceConfig, "id" | "smartsheetId">,
  rowId: string | number | null | undefined,
  audience: NotificationAudience,
): string {
  if (audience === "student") {
    const sheetId = encodeURIComponent(String(source.smartsheetId));
    if (rowId != null) return `/student/${sheetId}/${encodeURIComponent(String(rowId))}`;
    return `/student/${sheetId}`;
  }
  const base = `/admin/sources/${encodeURIComponent(source.id)}/sheet`;
  if (rowId != null) return `${base}?rowId=${encodeURIComponent(String(rowId))}`;
  return base;
}

/**
 * Drop alerts whose sheet is not a page in this workspace (those links 404).
 * Rewrite the rest to the sheet page the viewer can actually open.
 */
export function presentVisibleNotifications(
  items: UserNotification[],
  sources: SheetSource[],
  audience: NotificationAudience,
): UserNotification[] {
  const sheets = sources.filter((source) => isOpenableSheet(source, audience));
  const bySheetId = new Map(sheets.map((source) => [String(source.smartsheetId), source]));
  const bySourceId = new Map(sheets.map((source) => [source.id, source]));

  const visible: UserNotification[] = [];
  for (const item of items) {
    const target = readTarget(item);
    const hasTarget = Boolean(target.sheetId || target.sourceId || target.deadPath);
    if (!hasTarget) {
      visible.push(item);
      continue;
    }
    const source =
      (target.sheetId ? bySheetId.get(target.sheetId) : undefined) ??
      (target.sourceId ? bySourceId.get(target.sourceId) : undefined);
    if (!source) continue;
    visible.push({
      ...item,
      payload: {
        ...item.payload,
        sheetId: String(source.smartsheetId),
        href: notificationHref(source, item.payload.rowId, audience),
      },
    });
  }
  return visible;
}

export function notificationAudience(principal: {
  kind?: string;
  role?: string;
  capabilities?: readonly string[];
}): NotificationAudience {
  const caps = principal.capabilities ?? [];
  const staff =
    principal.kind === "admin" ||
    principal.kind === "form_approver" ||
    Boolean(principal.role) ||
    caps.some((capability) =>
      ["admin.manage", "admin.owner", "forms.admin", "forms.approver", "forms.coordinator"].includes(capability),
    );
  return staff ? "staff" : "student";
}
