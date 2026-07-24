import * as registry from "@/lib/forms/registry";

export type ResolvedSheetId =
  | { ok: true; sheetId: string }
  | { ok: false; status: number; error: string };

/**
 * Resolve which registered form sheet to use for Forms Sheet viewing.
 * Prefer an explicit sheetId (must be in the forms registry); otherwise fall back to active.
 */
export async function resolveFormsSheetId(requestedSheetId?: string | null): Promise<ResolvedSheetId> {
  const requested = requestedSheetId?.trim() ?? "";
  if (requested) {
    const form = await registry.getFormById(requested);
    if (!form) {
      return { ok: false, status: 404, error: "Form not found for that sheet id." };
    }
    return { ok: true, sheetId: form.id };
  }

  const active = await registry.activeSheetId();
  if (!active) {
    return { ok: false, status: 409, error: "No form selected yet." };
  }
  return { ok: true, sheetId: active };
}

/** Read sheetId from a request URL query string. */
export function sheetIdFromRequest(request: Request): string | null {
  try {
    const value = new URL(request.url).searchParams.get("sheetId");
    return value?.trim() || null;
  } catch {
    return null;
  }
}

/** Prefer body.sheetId, then query sheetId. */
export function sheetIdFromRequestOrBody(request: Request, body: unknown): string | null {
  if (body && typeof body === "object" && "sheetId" in body) {
    const raw = (body as { sheetId?: unknown }).sheetId;
    if (raw != null && String(raw).trim()) return String(raw).trim();
  }
  return sheetIdFromRequest(request);
}
