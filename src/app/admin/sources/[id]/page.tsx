import { notFound } from "next/navigation";
import { SourceForm } from "@/components/admin/SourceForm";
import { PageHeader } from "@/components/layout/PageHeader";
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
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin builder"
        title={source?.label ?? "New source"}
        description={isNew ? "Register a Smartsheet sheet or report for use across workspace views." : "Update source connection, schema, and role-group configuration."}
      />
      <SourceForm initialSource={source} connectionKeys={listConfiguredConnectionKeys()} isNew={isNew} />
    </div>
  );
}