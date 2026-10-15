import { Suspense } from "react";
import { notFound } from "next/navigation";
import { SourceSheetView } from "@/components/admin/SourceSheetView";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { getSourceConfigById } from "@/lib/config/store";
import { normalizeFormSlug, slugFromFormName } from "@/lib/forms/slug";

export default async function SourceSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdminPageAccess(`/admin/sources/${id}/sheet`);

  const source = await getSourceConfigById(id);
  if (!source) notFound();
  if (source.sourceType !== "sheet") notFound();

  const sheetId = String(source.smartsheetId);
  const slug =
    normalizeFormSlug(source.formSlug?.trim() || "") ||
    slugFromFormName(source.label, sheetId) ||
    source.id;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[12rem] items-center justify-center rounded-xl border border-line-strong bg-white">
          <p className="text-sm text-sub">Loading sheet…</p>
        </div>
      }
    >
      <SourceSheetView sourceId={source.id} sheetId={sheetId} sourceLabel={slug} />
    </Suspense>
  );
}
