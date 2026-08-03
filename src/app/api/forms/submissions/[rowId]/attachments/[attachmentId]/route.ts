import { NextResponse } from "next/server";
import { config } from "@/lib/forms/config";
import * as ss from "@/lib/forms/smartsheet-api";
import { ensureBootstrapped } from "@/lib/forms/init";
import { formsAuthErrorResponse, requireFormsAccess } from "@/lib/forms/forms-api";
import { resolveFormsSheetId, sheetIdFromRequest } from "@/lib/forms/sheet-access";
import type { Attachment } from "@/lib/forms/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentDisposition(disposition: "inline" | "attachment", fileName: string) {
  const safe = fileName.replace(/[\r\n"]/g, "_").trim() || "attachment";
  const encoded = encodeURIComponent(safe);
  return `${disposition}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

function guessMimeType(fileName: string, fallback?: string | null) {
  if (fallback && fallback !== "application/octet-stream") return fallback;
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (/\.(png)$/i.test(lower)) return "image/png";
  if (/\.(jpe?g)$/i.test(lower)) return "image/jpeg";
  if (/\.(gif)$/i.test(lower)) return "image/gif";
  if (/\.(webp)$/i.test(lower)) return "image/webp";
  if (/\.(txt)$/i.test(lower)) return "text/plain";
  return fallback || "application/octet-stream";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ rowId: string; attachmentId: string }> },
) {
  const access = await requireFormsAccess(request);
  if ("response" in access) return access.response;

  const { attachmentId } = await params;
  await ensureBootstrapped();
  const resolved = await resolveFormsSheetId(sheetIdFromRequest(request));
  if (!resolved.ok) {
    return Response.json({ error: resolved.error }, { status: resolved.status });
  }
  const sheetId = resolved.sheetId;

  const url = new URL(request.url);
  const wantMeta = url.searchParams.get("meta") === "1";
  const disposition =
    url.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";

  try {
    const attachment = (await ss.getAttachment(sheetId, attachmentId)) as Attachment;
    const name = typeof attachment?.name === "string" && attachment.name.trim()
      ? attachment.name.trim()
      : `attachment-${attachmentId}`;
    const mimeType = guessMimeType(name, attachment?.mimeType);
    const remoteUrl = typeof attachment?.url === "string" ? attachment.url.trim() : "";

    if (wantMeta) {
      return Response.json({
        id: attachment?.id ?? Number(attachmentId),
        name,
        mimeType,
        previewable: mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType === "text/plain",
      });
    }

    if (config.demo || !remoteUrl || remoteUrl.includes("demo.local")) {
      const body = `Demo attachment: ${name}\n`;
      return new NextResponse(body, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": contentDisposition(disposition, name.endsWith(".txt") ? name : `${name}.txt`),
          "Cache-Control": "private, no-store",
        },
      });
    }

    const upstream = await fetch(remoteUrl, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return Response.json(
        { error: "Could not download attachment from Smartsheet." },
        { status: 502 },
      );
    }

    const contentType = guessMimeType(name, upstream.headers.get("content-type") || mimeType);
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition(disposition, name),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return formsAuthErrorResponse(e);
  }
}
