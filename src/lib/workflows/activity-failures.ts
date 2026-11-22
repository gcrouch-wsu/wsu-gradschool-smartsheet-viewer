import { listSourceConfigs } from "@/lib/config/store";
import { isFormsDatabaseEnabled } from "@/lib/forms/db";
import { listFailedWorkflowRuns, type FailedWorkflowRun } from "@/lib/workflows/store";

export interface ActivityFailedRun extends FailedWorkflowRun {
  workflowHref: string | null;
}

export async function listActivityFailures(): Promise<{ available: boolean; runs: ActivityFailedRun[] }> {
  if (!isFormsDatabaseEnabled()) return { available: false, runs: [] };
  const [runs, sources] = await Promise.all([listFailedWorkflowRuns(), listSourceConfigs()]);
  const hrefBySheet = new Map(
    sources
      .filter((source) => source.sourceType === "sheet")
      .map((source) => [String(source.smartsheetId), `/admin/sources/${source.id}/workflows`]),
  );
  return {
    available: true,
    runs: runs.map((run) => ({ ...run, workflowHref: hrefBySheet.get(run.sheetId) ?? null })),
  };
}
