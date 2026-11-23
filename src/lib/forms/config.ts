const token = (process.env.SMARTSHEET_TOKEN ?? process.env.SMARTSHEET_API_TOKEN ?? "").trim();

const smartsheetBaseUrl = (process.env.SMARTSHEET_API_BASE_URL ?? "https://api.smartsheet.com/2.0").replace(/\/$/, "");

export const config = {
  smartsheetToken: token,
  smartsheetBaseUrl,
  allowedDomains: (process.env.ALLOWED_DOMAINS ?? "wsu.edu")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean),
  defaultWorkspaceId: process.env.DEFAULT_WORKSPACE_ID ?? "",
  defaultFolderId: process.env.DEFAULT_FOLDER_ID ?? "",
  autoShareGroupIds: (process.env.AUTO_SHARE_GROUP_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  maxAttachmentMb: Number(process.env.MAX_ATTACHMENT_MB ?? 25),
  allowedAttachmentTypes: (process.env.ALLOWED_ATTACHMENT_TYPES ?? "pdf,doc,docx,jpg,jpeg,png")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  attachmentsEnabled: process.env.ATTACHMENTS_ENABLED !== "false",
  webhookCallbackUrl: process.env.WEBHOOK_CALLBACK_URL ?? "",
};

export interface Workflow {
  approvalStages: string[];
  overallColumn: string;
  approvedValues: string[];
  declinedValues: string[];
  excludeFromForm: string[];
}

export function defaultWorkflow(): Workflow {
  return {
    approvalStages: ["Director Status", "Signature Authority Status", "Academic Coordinator Status"],
    overallColumn: "Overall Stage",
    approvedValues: ["Approved", "Signed", "Complete", "Starred"],
    declinedValues: ["Declined", "Rejected"],
    excludeFromForm: ["Status"],
  };
}

export { loadWorkflow, saveWorkflow } from "@/lib/forms/store/workflow-config";
export { loadConditionalRules as loadConditionalLogic, saveConditionalRules } from "@/lib/forms/store/conditional-rules";
