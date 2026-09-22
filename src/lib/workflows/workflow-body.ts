import type { SaveWorkflowInput } from "@/lib/workflows/store";
import type { WorkflowAction, WorkflowTrigger } from "@/lib/workflows/types";
import type { ViewFilterConfig } from "@/lib/config/types";

export function workflowBody(
  body: Record<string, unknown>,
  sheetId: string,
  email: string | null,
): SaveWorkflowInput {
  return {
    sheetId: String(body.sheetId ?? sheetId),
    name: String(body.name ?? ""),
    enabled: Boolean(body.enabled),
    templateKind: String(body.templateKind ?? ""),
    createdByEmail: email,
    trigger: (body.trigger ?? { event: "row_updated", delivery: "immediate" }) as WorkflowTrigger,
    conditions: (Array.isArray(body.conditions) ? body.conditions : []) as ViewFilterConfig[],
    action: (body.action ?? { kind: "in_app_notification" }) as WorkflowAction,
  };
}
