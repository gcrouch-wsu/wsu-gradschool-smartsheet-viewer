import { config } from "@/lib/forms/config";
import { duplicateForm } from "@/lib/forms/duplicate-form";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const newName = body.newName != null ? String(body.newName) : undefined;
  const destinationFolderId =
    body.destinationFolderId != null && String(body.destinationFolderId).trim()
      ? String(body.destinationFolderId).trim()
      : undefined;

  try {
    const result = await duplicateForm(id, { newName, destinationFolderId, makeActive: true });
    return Response.json(
      {
        ok: true,
        form: result.form,
        sheet: result.sheet,
        note: result.note || undefined,
        copied: result.copied,
        demo: config.demo,
      },
      { status: 201 },
    );
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
