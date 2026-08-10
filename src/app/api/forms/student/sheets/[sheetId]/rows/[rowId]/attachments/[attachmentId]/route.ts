import { NextResponse } from "next/server";
import { config } from "@/lib/forms/config";
import { ensureBootstrapped } from "@/lib/forms/init";
import * as ss from "@/lib/forms/smartsheet-api";
import { requireStudentSession } from "@/lib/forms/student-auth";
import { assertOwnedRow, loadOwnedSheetContext } from "@/lib/forms/student-rows";
import type { Attachment } from "@/lib/forms/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function contentDisposition(disposition: "inline" | "attachment", fileName: string) {
  const safe = fileName.replace(/[\r\n"]/g, "_").trim() || "attachment";
  return `${disposition}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}

function guessMimeType(fileName: string, fallback?: string | null) {
  if (fallback && fallback !== "application/octet-stream") return fallback;
  if (/\.pdf$/i.test(fileName)) return "application/pdf";
  if (/\.png$/i.test(fileName)) return "image/png";
  if (/\.(jpe?g)$/i.test(fileName)) return "image/jpeg";
  if (/\.gif$/i.test(fileName)) return "image/gif";
  if (/\.webp$/i.test(fileName)) return "image/webp";
  if (/\.txt$/i.test(fileName)) return "text/plain";
  return fallback || "application/octet-stream";
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ sheetId: string; rowId: string; attachmentId: string }> },
) {
  const session = await requireStudentSession();
  if (!session.ok) return session.response;

  await ensureBootstrapped();
  const { sheetId, rowId, attachmentId } = await params;
  const rowIdNum = Number(rowId);
  if (!Number.isFinite(rowIdNum)) {
    return NextResponse.json({ error: "Invalid row id." }, { status: 400 });
  }

  try {
    const loaded = await loadOwnedSheetContext(sheetId, session.email);
    if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    if (!assertOwnedRow(loaded.context, rowIdNum, session.email)) {
      return NextResponse.json({ error: "Submission not found." }, { status: 404 });
    }

    const attachment = (await ss.getAttachment(loaded.context.entry.sheetId, attachmentId)) as Attachment;
    const name =
      typeof attachment?.name === "string" && attachment.name.trim()
        ? attachment.name.trim()
        : `attachment-${attachmentId}`;
    const mimeType = guessMimeType(name, attachment?.mimeType);
    const url = new URL(request.url);
    const isMetaRequest = url.searchParams.get("meta") === "1";
    const disposition = url.searchParams.get("disposition") === "attachment" ? "attachment" : "inline";

    if (isMetaRequest) {
      return NextResponse.json({
        id: attachment?.id ?? Number(attachmentId),
        name,
        mimeType,
        previewable: mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType === "text/plain",
      });
    }

    const remoteUrl = typeof attachment?.url === "string" ? attachment.url.trim() : "";
    if (config.demo || !remoteUrl || remoteUrl.includes("demo.local")) {
      return new NextResponse(`Demo attachment: ${name}\n`, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": contentDisposition(disposition, name.endsWith(".txt") ? name : `${name}.txt`),
          "Cache-Control": "private, no-store",
        },
      });
    }

    const upstream = await fetch(remoteUrl, { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "Could not download attachment from Smartsheet." }, { status: 502 });
    }

    return new NextResponse(upstream.body, {
      headers: {
        "Content-Type": guessMimeType(name, upstream.headers.get("content-type") || mimeType),
        "Content-Disposition": contentDisposition(disposition, name),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load attachment." },
      { status: 500 },
    );
  }
}
