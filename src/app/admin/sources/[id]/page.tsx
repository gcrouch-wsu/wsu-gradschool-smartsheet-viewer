import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SourceForm } from "@/components/admin/SourceForm";
import { Button } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { isDatabaseConfigEnabled } from "@/lib/config/config-db";
import { getSourceConfigById } from "@/lib/config/store";
import { listConfiguredConnectionKeys } from "@/lib/smartsheet";
import { isSmartsheetApiEnabled } from "@/lib/smartsheet-api-gate";

export default async function SourceEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPageAccess(`/admin/sources/${id}`);
  const isNew = id === "new";
  const smartsheetApiEnabled =
    !isDatabaseConfigEnabled() || (await isSmartsheetApiEnabled());
  if (isNew && !smartsheetApiEnabled) {
    redirect("/admin/sources");
  }
  const source = isNew ? null : await getSourceConfigById(id);

  if (!isNew && !source) {
    notFound();
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Admin builder"
        title={source?.label ?? "New source"}
        description={
          isNew
            ? "Register a Smartsheet sheet or report for views and forms."
            : smartsheetApiEnabled
              ? "Update source connection, schema, role groups, and form publish settings."
              : "Update the linked sheet, schema, role groups, and form publish settings."
        }
        actions={
          <Link href="/admin/sources">
            <Button>Back to sources</Button>
          </Link>
        }
      />
      <SourceForm
        initialSource={source}
        connectionKeys={listConfiguredConnectionKeys()}
        isNew={isNew}
        smartsheetApiEnabled={smartsheetApiEnabled}
      />
    </div>
  );
}