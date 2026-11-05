import { NextResponse } from "next/server";
import {
  AdminAuthenticationError,
  adminAuthenticationErrorResponse,
  requireAuthenticatedAdmin,
} from "@/lib/admin-users";
import { auditFromAdminPrincipal, UI_AUDIT_BATCH_LIMIT } from "@/lib/audit";

export const runtime = "nodejs";

type UiEventIn = {
  action?: unknown;
  resourceType?: unknown;
  resourceId?: unknown;
  label?: unknown;
  href?: unknown;
  path?: unknown;
  at?: unknown;
};

function cleanText(value: unknown, max = 160): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}

/**
 * Batched admin UI activity (clicks, page views).
 * Any signed-in staff session (including coordinators). Never stores field values.
 */
export async function POST(request: Request) {
  let principal;
  try {
    principal = await requireAuthenticatedAdmin();
  } catch (error) {
    if (error instanceof AdminAuthenticationError) {
      return adminAuthenticationErrorResponse(error);
    }
    throw error;
  }

  const body = (await request.json().catch(() => null)) as { events?: unknown } | null;
  if (!Array.isArray(body?.events)) {
    return NextResponse.json({ message: "events array is required." }, { status: 400 });
  }

  const events = (body.events as UiEventIn[]).slice(0, UI_AUDIT_BATCH_LIMIT);
  let recorded = 0;

  for (const event of events) {
    const action = cleanText(event.action, 80) ?? "ui.unknown";
    if (!action.startsWith("ui.")) continue;

    const resourceType = cleanText(event.resourceType, 64) ?? "ui";
    const resourceId = cleanText(event.resourceId, 120);
    const label = cleanText(event.label, 160);
    const href = cleanText(event.href, 240);
    const path = cleanText(event.path, 240);
    const at = typeof event.at === "number" && Number.isFinite(event.at) ? event.at : undefined;

    await auditFromAdminPrincipal(principal, action, resourceType, resourceId, {
      label,
      href,
      path,
      clientAt: at,
    });
    recorded += 1;
  }

  return NextResponse.json({ ok: true, recorded });
}
