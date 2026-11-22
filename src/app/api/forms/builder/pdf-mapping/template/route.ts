import { requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { auditFromPrincipal } from "@/lib/audit";
import { ensureBootstrapped } from "@/lib/forms/init";
import { inspectPdfTemplate, PdfMappingError } from "@/lib/forms/pdf-mapping";
import { normalizePdfMappingConfig, type PdfTemplateField } from "@/lib/forms/pdf-mapping-types";
import * as registry from "@/lib/forms/registry";
import { clearPdfTemplate, loadPdfMapping, savePdfTemplate } from "@/lib/forms/store/pdf-mapping";
import { resolveAdminPrincipal } from "@/lib/identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEMPLATE_BYTES = 8 * 1024 * 1024;

function matchColumn(
  fieldName: string,
  columns: Array<{ columnTitle: string; label?: string }>,
): string {
  const name = fieldName.trim().toLowerCase();
  const hit = columns.find((column) => {
    const title = column.columnTitle.trim().toLowerCase();
    const label = column.label?.trim().toLowerCase();
    return title === name || label === name;
  });
  return hit?.columnTitle ?? "";
}

export async function POST(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const form = await request.formData().catch(() => null);
  const sheetId = String(form?.get("sheetId") ?? "").trim() || (await registry.activeSheetId());
  if (!sheetId) {
    return Response.json({ error: "No form selected yet. Open Manage to create or pick one." }, { status: 409 });
  }
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Choose a PDF file to upload." }, { status: 400 });
  }
  if (file.size <= 0 || file.size > MAX_TEMPLATE_BYTES) {
    return Response.json({ error: "Upload a PDF smaller than 8 MB." }, { status: 400 });
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!bytes.subarray(0, 5).toString("utf8").startsWith("%PDF")) {
    return Response.json({ error: "That file is not a PDF." }, { status: 400 });
  }

  let columns: Array<{ columnTitle: string; label?: string }> = [];
  try {
    const raw = String(form?.get("columns") ?? "");
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const next: Array<{ columnTitle: string; label?: string }> = [];
        for (const item of parsed) {
          if (!item || typeof item !== "object") continue;
          const data = item as Record<string, unknown>;
          const columnTitle = String(data.columnTitle ?? "").trim();
          if (!columnTitle) continue;
          const label = String(data.label ?? "").trim();
          next.push({ columnTitle, label: label || undefined });
        }
        columns = next;
      }
    }
  } catch {
    columns = [];
  }

  try {
    const detected = await inspectPdfTemplate(bytes);
    const existing = await loadPdfMapping(sheetId);
    const previous = new Map((existing?.config.templateFields ?? []).map((field) => [field.name, field.columnTitle]));
    const templateFields: PdfTemplateField[] = detected.map((field) => ({
      ...field,
      columnTitle: previous.get(field.name) || matchColumn(field.name, columns),
    }));
    const config = normalizePdfMappingConfig({
      ...(existing?.config ?? {}),
      source: "uploaded",
      templateFields,
      enabled: existing?.config.enabled ?? true,
    });
    const record = await savePdfTemplate(sheetId, bytes, file.name || "template.pdf", config);
    const principal = await resolveAdminPrincipal();
    if (principal) {
      await auditFromPrincipal(principal, "forms.pdf_mapping.template", "form", sheetId, {
        templateName: record.templateName,
        fields: templateFields.length,
      });
    }
    return Response.json({
      sheetId,
      config: record.config,
      templateName: record.templateName,
      hasTemplate: record.hasTemplate,
    });
  } catch (err) {
    if (err instanceof PdfMappingError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("[pdf-mapping template POST]", err);
    return Response.json({ error: "Could not save that PDF." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const sheetId = new URL(request.url).searchParams.get("sheetId")?.trim() || (await registry.activeSheetId());
  if (!sheetId) {
    return Response.json({ error: "No form selected yet." }, { status: 409 });
  }

  try {
    const record = await clearPdfTemplate(sheetId);
    const principal = await resolveAdminPrincipal();
    if (principal) {
      await auditFromPrincipal(principal, "forms.pdf_mapping.template_delete", "form", sheetId);
    }
    return Response.json({
      sheetId,
      config: record.config,
      templateName: null,
      hasTemplate: false,
    });
  } catch (err) {
    console.error("[pdf-mapping template DELETE]", err);
    return Response.json({ error: "Could not remove the uploaded PDF." }, { status: 500 });
  }
}
