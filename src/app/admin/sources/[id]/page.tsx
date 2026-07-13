import { notFound } from "next/navigation";
import { SourceForm } from "@/components/admin/SourceForm";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { getSourceConfigById } from "@/lib/config/store";
import { listConfiguredConnectionKeys } from "@/lib/smartsheet";

export default async function SourceEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPageAccess(`/admin/sources/${id}`);
  const isNew = id === "new";
  const source = isNew ? null : await getSourceConfigById(id);

  if (!isNew && !source) {
    notFound();
  }

  return (
    <>
      <SourceForm initialSource={source} connectionKeys={listConfiguredConnectionKeys()} isNew={isNew} />
    </>
  );
}