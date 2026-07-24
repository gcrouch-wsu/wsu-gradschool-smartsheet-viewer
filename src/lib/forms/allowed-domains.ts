import { config } from "@/lib/forms/config";
import type { FormFieldConfig } from "@/lib/forms/form-field-config";

const DEFAULT_ALLOWED_DOMAINS = ["wsu.edu"];

function normalizeDomainList(domains: string[] | undefined | null): string[] {
  if (!Array.isArray(domains)) return [];
  return domains
    .map((d) => String(d).trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Resolve allowed email domains for a form:
 * 1. Non-empty per-form list from field config
 * 2. Else env ALLOWED_DOMAINS
 * 3. Else ["wsu.edu"]
 * Never returns an empty list (would mean allow-all).
 */
export function resolveAllowedDomains(fieldConfig?: FormFieldConfig | null): string[] {
  const fromForm = normalizeDomainList(fieldConfig?.allowedDomains);
  if (fromForm.length) return fromForm;

  const fromEnv = normalizeDomainList(config.allowedDomains);
  if (fromEnv.length) return fromEnv;

  return [...DEFAULT_ALLOWED_DOMAINS];
}

/**
 * Resolve whether file uploads are allowed for a form:
 * 1. Explicit per-form boolean on field config
 * 2. Else env ATTACHMENTS_ENABLED (default true)
 */
export function resolveAttachmentsEnabled(fieldConfig?: FormFieldConfig | null): boolean {
  if (typeof fieldConfig?.attachmentsEnabled === "boolean") {
    return fieldConfig.attachmentsEnabled;
  }
  return config.attachmentsEnabled;
}

export { DEFAULT_ALLOWED_DOMAINS };
