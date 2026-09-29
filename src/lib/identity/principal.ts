/**
 * Unified identity abstraction. Cookie issuance uses platform-session + legacy admin;
 * this normalizes the read/guard surface.
 */

import type { PlatformRole } from "@/lib/identity/roles";

export type PrincipalKind = "admin" | "contributor" | "form_approver" | "student" | "platform";

export type PrincipalCapability =
  | "admin.manage"
  | "admin.owner"
  | "forms.admin"
  | "forms.approver"
  | "forms.coordinator"
  | "forms.student"
  | "contributor.edit"
  | "viewer";

export interface Principal {
  kind: PrincipalKind;
  id: string;
  identifier: string;
  displayName: string;
  email?: string;
  /** Legacy single staff role for AdminPrincipal compatibility. */
  role?: "owner" | "admin" | "coordinator" | "programs_team";
  /** Assigned platform roles (multi-role). */
  roles?: PlatformRole[];
  source?: "env" | "managed";
  capabilities: PrincipalCapability[];
  session: {
    issuedAt: number;
    expiresAt: number;
    credentialsVersion?: string;
    version?: string;
  };
}

export function principalHasCapability(principal: Principal, capability: PrincipalCapability): boolean {
  return principal.capabilities.includes(capability);
}

export function principalHasAnyCapability(
  principal: Principal,
  capabilities: PrincipalCapability[],
): boolean {
  return capabilities.some((c) => principal.capabilities.includes(c));
}

/** Derive legacy PrincipalKind from capabilities when kind is platform. */
export function kindFromCapabilities(capabilities: readonly PrincipalCapability[]): PrincipalKind {
  if (capabilities.includes("admin.manage") || capabilities.includes("admin.owner")) {
    return "admin";
  }
  if (capabilities.includes("forms.coordinator")) {
    return "admin";
  }
  if (capabilities.includes("forms.approver") && !capabilities.includes("forms.student")) {
    return "form_approver";
  }
  if (capabilities.includes("forms.student")) {
    return "student";
  }
  if (capabilities.includes("contributor.edit")) {
    return "contributor";
  }
  return "platform";
}
