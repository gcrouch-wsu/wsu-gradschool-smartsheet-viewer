import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ folderId: string }> },
) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  const { folderId } = await params;
  await ensureBootstrapped();

  try {
    const children = await ss.listFolderChildren(folderId);
    return Response.json({ children, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
