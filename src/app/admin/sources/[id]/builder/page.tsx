import { notFound } from "next/navigation";
import { FormBuilderView } from "@/components/forms/builder/FormBuilderView";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { getSourceConfigById } from "@/lib/config/store";

export default async function SourceBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdminPageAccess(`/admin/sources/${id}/builder`);

  const source = await getSourceConfigById(id);
  if (!source) notFound();
  if (source.sourceType !== "sheet" || source.formsEnabled === false) notFound();

  return <FormBuilderView sheetId={String(source.smartsheetId)} sourceId={source.id} />;
}
