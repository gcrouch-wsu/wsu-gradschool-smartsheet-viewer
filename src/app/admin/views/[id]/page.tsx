import { notFound } from "next/navigation";
import { ViewBuilder } from "@/components/admin/ViewBuilder";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { getViewConfigById, listSourceConfigs, listViewConfigs } from "@/lib/config/store";

export default async function ViewEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPageAccess(`/admin/views/${id}`);
  const [sources, view, existingViews] = await Promise.all([
    listSourceConfigs(),
    id === "new" ? Promise.resolve(null) : getViewConfigById(id),
    listViewConfigs(),
  ]);
  const isNew = id === "new";

  if (!isNew && !view) {
    notFound();
  }

  return (
    <>
      <ViewBuilder
        initialView={view}
        sources={sources}
        existingViews={existingViews.map((item) => ({
          id: item.id,
          label: item.label,
          slug: item.slug,
          sourceId: item.sourceId,
          public: item.public,
        }))}
        isNew={isNew}
      />
    </>
  );
}
