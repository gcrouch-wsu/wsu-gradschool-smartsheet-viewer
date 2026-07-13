import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ConditionalRule } from "@/lib/forms/types";

const root = process.cwd();

const token = (process.env.SMARTSHEET_TOKEN ?? process.env.SMARTSHEET_API_TOKEN ?? "").trim();
const demoFlag = (process.env.DEMO ?? "").trim().toLowerCase();

/** Demo uses in-memory mock Smartsheet data. DEMO=false forces live mode; otherwise auto-on when no token. */
const demo = demoFlag === "true" ? true : demoFlag === "false" ? false : !token;

const smartsheetBaseUrl = (process.env.SMARTSHEET_API_BASE_URL ?? "https://api.smartsheet.com/2.0").replace(/\/$/, "");

export const config = {
  demo,
  smartsheetToken: token,
  smartsheetBaseUrl,
  templateSheetId: process.env.TEMPLATE_SHEET_ID ?? "",
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

/** Synchronous file fallback when async store is unavailable. */
export function syncLoadWorkflow(): Workflow {
  const fallback = defaultWorkflow();
  try {
    const raw = readFileSync(resolve(root, "config/forms/workflow.json"), "utf8");
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return fallback;
  }
}

/** Synchronous file fallback when async store is unavailable. */
export function syncLoadConditionalLogic(): ConditionalRule[] {
  try {
    const raw = readFileSync(resolve(root, "config/forms/conditional-logic.json"), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @deprecated Prefer per-sheet workflow from store modules. */
export function formExcludeSet(): Set<string> {
  const wf = syncLoadWorkflow();
  return new Set([...wf.approvalStages, wf.overallColumn, ...wf.excludeFromForm].map((s) => s.toLowerCase()));
}

export { loadWorkflow, saveWorkflow } from "@/lib/forms/store/workflow-config";
export { loadConditionalRules as loadConditionalLogic, saveConditionalRules } from "@/lib/forms/store/conditional-rules";
