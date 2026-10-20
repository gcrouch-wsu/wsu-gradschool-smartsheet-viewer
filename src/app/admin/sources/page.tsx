import {
  SOURCES_LIST_TOUR_STEPS,
  SOURCES_LIST_TOUR_STORAGE_KEY,
} from "@/components/admin/tours/sources-list-tour";
import { SourcesCatalogClient } from "@/components/admin/SourcesCatalogClient";
import type { SourceCatalogRow } from "@/components/admin/SourcesCatalogTable";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductTourControls } from "@/components/ui/ProductTourHost";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listSourceConfigs, listViewConfigs } from "@/lib/config/store";
import { normalizeFormSlug, slugFromFormName } from "@/lib/forms/slug";

export default async function SourcesIndexPage() {
  await requireAdminPageAccess("/admin/sources");
  const [sources, views] = await Promise.all([listSourceConfigs(), listViewConfigs()]);

  const viewsBySource = views.reduce<Map<string, number>>((map, view) => {
    map.set(view.sourceId, (map.get(view.sourceId) ?? 0) + 1);
    return map;
  }, new Map());

  const rows: SourceCatalogRow[] = sources.map((source) => {
    const formsEnabled = source.sourceType === "sheet" && source.formsEnabled !== false;
    const sheetId = String(source.smartsheetId);
    const slug = formsEnabled
      ? normalizeFormSlug(source.formSlug?.trim() || "") || slugFromFormName(source.label, sheetId)
      : null;
    return {
      id: source.id,
      sheetId,
      name: source.label,
      sourceType: source.sourceType,
      formsEnabled,
      provenance: source.formProvenance ?? null,
      slug,
      createdAt: source.formRegisteredAt ?? null,
      public: Boolean(source.formPublic),
      viewCount: viewsBySource.get(source.id) ?? 0,
    };
  });

  return (
    <section className="space-y-6">
      <PageHeader
        eyebrow="Admin builder"
        title="Sources"
        description="Shared catalog for public views and forms. Open sheet or builder from a row; publish for /f URLs."
        dataTour="as-heading"
        actions={
          <ProductTourControls storageKey={SOURCES_LIST_TOUR_STORAGE_KEY} steps={SOURCES_LIST_TOUR_STEPS} />
        }
      />
      <SourcesCatalogClient initialRows={rows} />
    </section>
  );
}
