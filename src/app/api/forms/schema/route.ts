import { config, loadConditionalLogic } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { resolveFormColumns } from "@/lib/forms/form-fields";
import { fieldMetaFromConfig } from "@/lib/forms/form-field-meta";
import { loadFormFields } from "@/lib/forms/store/field-config";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireFormsAccess(request);
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const active = await registry.activeSheetId();
  if (!active) {
    return Response.json({ error: "No form selected yet. Open the admin page to create or pick one." }, { status: 409 });
  }

  try {
    const sheet = await ss.getSheet(active);
    const extracted = ss.extractColumns(sheet);
    const { columns, source: formColumnSource } = await resolveFormColumns(sheet, extracted);
    const fieldConfig = await loadFormFields(active);
    const fieldMeta = fieldMetaFromConfig(fieldConfig);
    const conditionalLogic = await loadConditionalLogic(active);
    return Response.json({
      sheetName: sheet.name,
      columns,
      formColumnSource,
      fieldMeta,
      conditionalLogic,
      allowedDomains: config.allowedDomains,
      demo: config.demo,
      attachmentsEnabled: config.attachmentsEnabled,
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
