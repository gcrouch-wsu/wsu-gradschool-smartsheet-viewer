import { loadConditionalLogic, config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { validateSubmission } from "@/lib/forms/validation";
import { resolveFormColumns } from "@/lib/forms/form-fields";
import { fieldMetaFromConfig } from "@/lib/forms/form-field-meta";
import { loadFormFields } from "@/lib/forms/store/field-config";
import { rateLimit } from "@/lib/forms/rate-limit";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAccess } from "@/lib/forms/forms-api";
import { getTrustedClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ext(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

async function parseBody(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("multipart/form-data")) {
    const form = await request.formData();
    const valuesRaw = form.get("values");
    const values = valuesRaw ? JSON.parse(String(valuesRaw)) : {};
    const files: { name: string; blob: Blob }[] = [];
    for (const [key, val] of form.entries()) {
      if (key.startsWith("file") && val instanceof Blob) {
        const name = (val as File).name || "upload";
        files.push({ name, blob: val });
      }
    }
    return { values, files };
  }
  const body = await request.json().catch(() => ({}));
  return {
    values: body.values ?? {},
    files: [] as { name: string; blob: Blob }[],
  };
}

export async function POST(request: Request) {
  const access = await requireFormsAccess(request);
  if ("response" in access) return access.response;

  await ensureBootstrapped();
  const ip = getTrustedClientIp(request.headers);

  if (!(await rateLimit(`submit:${ip}`))) {
    return Response.json({ error: "Too many submissions. Please wait a minute." }, { status: 429 });
  }

  const active = await registry.activeSheetId();
  if (!active) return Response.json({ error: "No form selected yet." }, { status: 409 });

  const { values, files } = await parseBody(request);

  if (files.length && !config.attachmentsEnabled) {
    return Response.json({ error: "File uploads are disabled." }, { status: 400 });
  }

  for (const f of files) {
    const e = ext(f.name);
    if (config.allowedAttachmentTypes.length && !config.allowedAttachmentTypes.includes(e)) {
      return Response.json({ error: `File type .${e} is not allowed.` }, { status: 422 });
    }
    if (f.blob.size > config.maxAttachmentMb * 1024 * 1024) {
      return Response.json({ error: `File ${f.name} exceeds ${config.maxAttachmentMb}MB limit.` }, { status: 422 });
    }
  }

  try {
    const sheet = await ss.getSheet(active);
    const { columns } = await resolveFormColumns(sheet, ss.extractColumns(sheet));
    const conditionalLogic = await loadConditionalLogic(active);
    const fieldConfig = await loadFormFields(active);
    const fieldMeta = fieldMetaFromConfig(fieldConfig);
    const result = validateSubmission(columns, values, conditionalLogic, fieldMeta);
    if (!result.ok) return Response.json({ errors: result.errors }, { status: 422 });

    const addResult = (await ss.addRow(active, result.cells)) as { result?: { id?: number } | { id?: number }[] };
    const rowId = Array.isArray(addResult?.result) ? addResult.result[0]?.id : addResult?.result?.id;

    if (files.length && rowId) {
      for (const f of files) {
        await ss.attachFile(active, rowId, f.blob, f.name);
      }
    }

    return Response.json({ ok: true, message: "Submitted — thank you.", rowId: rowId ?? null });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
