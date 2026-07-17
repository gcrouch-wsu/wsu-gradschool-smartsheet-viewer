import { csvResponse, rowsToCsv } from "@/lib/export-csv";
import { loadPublicPage } from "@/lib/public-view";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const viewId = url.searchParams.get("viewId")?.trim();

  const page = await loadPublicPage(slug);
  if (!page || page.views.length === 0) {
    return Response.json({ message: "View not found." }, { status: 404 });
  }

  const view = (viewId ? page.views.find((v) => v.id === viewId) : null) ?? page.views[0]!;
  const headers = view.fields.map((f) => f.label || f.key);
  const rows = view.rows.map((row) =>
    view.fields.map((field) => {
      const cell = row.fieldMap[field.key];
      if (!cell) return "";
      return cell.textValue || cell.listValue.join(cell.listDelimiter ?? ", ") || "";
    }),
  );

  const csv = rowsToCsv(headers, rows);
  return csvResponse(`${slug}-${view.id}.csv`, csv);
}
