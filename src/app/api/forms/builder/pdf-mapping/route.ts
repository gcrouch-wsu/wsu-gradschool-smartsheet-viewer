import { requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { auditFromPrincipal } from "@/lib/audit";
import { ensureBootstrapped } from "@/lib/forms/init";
import {
  normalizePdfMappingConfig,
  type PdfMappingConfig,
} from "@/lib/forms/pdf-mapping-types";
import * as registry from "@/lib/forms/registry";
import { deletePdfMapping, loadPdfMapping, savePdfMappingConfig } from "@/lib/forms/store/pdf-mapping";
import { resolveAdminPrincipal } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveSheetId(request: Request, body?: Record<string, unknown> | null): Promise<string | null> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("sheetId")?.trim();
  if (fromQuery) return fromQuery;
  if (body && typeof body.sheetId === "string" && body.sheetId.trim()) {
    return body.sheetId.trim();
  }
  return registry.activeSheetId();
}

export async function GET(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const sheetId = await resolveSheetId(request);
  if (!sheetId) {
    return Response.json({ error: "No form selected yet. Open Manage to create or pick one." }, { status: 409 });
  }

  try {
    const record = await loadPdfMapping(sheetId);
    return Response.json({
      sheetId,
      config: record?.config ?? null,
    });
  } catch (err) {
    console.error("[pdf-mapping GET]", err);
    return Response.json({ error: "Failed to load PDF settings." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sheetId = await resolveSheetId(request, body);
  if (!sheetId) {
    return Response.json({ error: "No form selected yet. Open Manage to create or pick one." }, { status: 409 });
  }

  try {
    const existing = await loadPdfMapping(sheetId);
    const next: PdfMappingConfig = normalizePdfMappingConfig({
      ...(existing?.config ?? {}),
      ...body,
      sheetId: undefined,
    });

    const record = await savePdfMappingConfig(sheetId, next);
    const principal = await resolveAdminPrincipal();
    if (principal) {
      await auditFromPrincipal(principal, "forms.pdf_mapping.save", "form", sheetId, {
        enabled: next.enabled,
      });
    }

    return Response.json({
      sheetId,
      config: record.config,
    });
  } catch (err) {
    console.error("[pdf-mapping PUT]", err);
    return Response.json({ error: "Failed to save PDF settings." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const sheetId = await resolveSheetId(request);
  if (!sheetId) {
    return Response.json({ error: "No form selected yet. Open Manage to create or pick one." }, { status: 409 });
  }

  try {
    await deletePdfMapping(sheetId);
    const principal = await resolveAdminPrincipal();
    if (principal) {
      await auditFromPrincipal(principal, "forms.pdf_mapping.delete", "form", sheetId);
    }
    return Response.json({ ok: true, sheetId });
  } catch (err) {
    console.error("[pdf-mapping DELETE]", err);
    return Response.json({ error: "Failed to delete PDF settings." }, { status: 500 });
  }
}
