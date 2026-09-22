import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";
import { EXCEL_IMPORT_MAX_BYTES, parseExcelImport } from "@/lib/forms/excel-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  try {
    await ensureBootstrapped();

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Choose an Excel (.xlsx) or CSV file." }, { status: 400 });
    }
    if (file.size <= 0) {
      return Response.json({ error: "The uploaded file is empty." }, { status: 400 });
    }
    if (file.size > EXCEL_IMPORT_MAX_BYTES) {
      return Response.json(
        { error: `File is too large (max ${EXCEL_IMPORT_MAX_BYTES / (1024 * 1024)} MB).` },
        { status: 400 },
      );
    }

    const filename = file.name || "upload.xlsx";
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseExcelImport(buffer, filename);

    return Response.json({
      ok: true,
      preview: parsed.preview,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read that file.";
    if (
      /headers|empty|too many|too large|Upload an|\.xlsx|\.csv|worksheets/i.test(message)
    ) {
      return Response.json({ error: message }, { status: 400 });
    }
    return formsAuthErrorResponse(e);
  }
}
