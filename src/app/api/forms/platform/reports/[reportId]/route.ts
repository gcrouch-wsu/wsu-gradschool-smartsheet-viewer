import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { reportId } = await params;
  await ensureBootstrapped();

  try {
    const report = await ss.getReport(reportId);
    return Response.json({ report, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { reportId } = await params;
  await ensureBootstrapped();

  const body = await request.json().catch(() => ({}));
  try {
    const result = await ss.updateReport(reportId, body);
    return Response.json({ ok: true, result, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ reportId: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { reportId } = await params;
  await ensureBootstrapped();

  try {
    await ss.deleteReport(reportId);
    return Response.json({ ok: true, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
