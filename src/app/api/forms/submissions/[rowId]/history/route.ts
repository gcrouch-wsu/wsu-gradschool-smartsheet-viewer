import * as ss from "@/lib/forms/smartsheet-api";
import { stageColumns } from "@/lib/forms/tracker";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAccess } from "@/lib/forms/forms-api";
import { resolveFormsSheetId, sheetIdFromRequest } from "@/lib/forms/sheet-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ rowId: string }> },
) {
  const access = await requireFormsAccess(request);
  if ("response" in access) return access.response;

  const { rowId } = await params;
  await ensureBootstrapped();
  const resolved = await resolveFormsSheetId(sheetIdFromRequest(request));
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }
  const sheetId = resolved.sheetId;

  try {
    const sheet = await ss.getSheet(sheetId);
    const stages = await stageColumns(sheet);

    const timeline: { name: string; value: string; at: string | null; by: string | null }[] = [];
    for (const st of stages) {
      const history = await ss.getCellHistory(sheetId, rowId, st.columnId);
      const latest = history[0] as {
        value?: unknown;
        displayValue?: unknown;
        modifiedAt?: string | null;
        modifiedBy?: { name?: string | null } | null;
      } | undefined;
      const value = latest ? String(latest.value ?? latest.displayValue ?? "") : "";
      if (value && latest) {
        timeline.push({
          name: st.name,
          value,
          at: latest.modifiedAt ?? null,
          by: latest.modifiedBy?.name ?? null,
        });
      }
    }
    return Response.json({ sheetId, rowId, timeline });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
