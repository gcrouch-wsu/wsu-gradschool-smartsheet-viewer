import { notFound } from "next/navigation";
import { WorkflowsWorkspace } from "@/components/workflows/WorkflowsWorkspace";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { getSourceConfigById } from "@/lib/config/store";

export default async function SourceWorkflowsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdminPageAccess(`/admin/sources/${id}/workflows`);

  const source = await getSourceConfigById(id);
  if (!source) notFound();
  if (source.sourceType !== "sheet") notFound();

  return (
    <WorkflowsWorkspace
      sheetId={String(source.smartsheetId)}
      sourceId={source.id}
      sourceLabel={source.label}
    />
  );
}
