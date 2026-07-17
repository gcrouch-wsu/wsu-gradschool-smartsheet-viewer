import { notFound } from "next/navigation";
import { SourceForm } from "@/components/admin/SourceForm";
import { SourcesUseInFormsButton } from "@/components/admin/SourcesUseInFormsButton";
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

  const formsEnabled = source?.sourceType === "sheet" && source.formsEnabled !== false;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin builder"
        title={source?.label ?? "New source"}
        description={
          isNew
            ? "Register a Smartsheet sheet or report for views and Forms."
            : "Update source connection, schema, and role-group configuration. Sheet sources can also drive Forms."
        }
        actions={
          formsEnabled && source ? (
            <SourcesUseInFormsButton sourceId={source.id} sheetId={source.smartsheetId} />
          ) : undefined
        }
      />
      <SourceForm initialSource={source} connectionKeys={listConfiguredConnectionKeys()} isNew={isNew} />
    </div>
  );
}