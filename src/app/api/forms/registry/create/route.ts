import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import * as registry from "@/lib/forms/registry";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAdminAccess } from "@/lib/forms/forms-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const access = await requireFormsAdminAccess();
  if ("response" in access) return access.response;

  await ensureBootstrapped();

  const body = await request.json().catch(() => ({}));
  const { mode, templateId, newName, destinationFolderId, shareEmails = [] } = body ?? {};
  const name = (newName && String(newName).trim()) || `WSU Form ${new Date().toISOString().slice(0, 10)}`;

  try {
    let sheet: { id: number | string; name: string };
    let note = "";

    if (mode === "template") {
      const tid = templateId || config.templateSheetId;
      if (!tid) return Response.json({ error: "Choose a template sheet first." }, { status: 400 });
      const include = ["forms", "rules", "ruleRecipients", "filters"];
      try {
        sheet = ((await ss.copySheetToFolder(tid, name, include, destinationFolderId)) as { result: { id: number | string; name: string } }).result;
      } catch {
        sheet = ((await ss.copySheetToFolder(tid, name, ["rules", "ruleRecipients", "filters"], destinationFolderId)) as { result: { id: number | string; name: string } }).result;
        note = "Cloned without the native form (forms include failed on this account); columns, rules, and recipients were carried over.";
      }
    } else {
      sheet = ((await ss.createSheet(name, ss.DEFAULT_COLUMNS)) as { result: { id: number | string; name: string } }).result;
      if (destinationFolderId || config.defaultFolderId) {
        try {
          await ss.moveSheet(sheet.id, destinationFolderId || config.defaultFolderId);
        } catch {
          /* non-fatal */
        }
      }
      note = "From-scratch sheet has no automations (the API cannot create them). Use a template if you need post-submission workflows.";
    }

    const emailsToShare: string[] = [...shareEmails];
    if (config.autoShareGroupIds.length) {
      try {
        const groups = (await ss.listGroups()) as { id?: string | number; name?: string }[];
        for (const gid of config.autoShareGroupIds) {
          const g = groups.find((x) => String(x.id) === gid);
          if (g?.name) emailsToShare.push(`${g.name}@groups.smartsheet.com`);
        }
      } catch {
        /* non-fatal */
      }
    }

    for (const email of emailsToShare) {
      if (!email) continue;
      try {
        await ss.shareSheet(sheet.id, email, "EDITOR");
      } catch {
        /* non-fatal per recipient */
      }
    }

    await registry.registerForm(
      { id: String(sheet.id), name: sheet.name, createdAt: new Date().toISOString(), source: mode === "template" ? "template" : "scratch" },
      true,
    );

    return Response.json({ ok: true, sheet: { id: sheet.id, name: sheet.name }, note, demo: config.demo });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
