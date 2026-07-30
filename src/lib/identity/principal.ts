/**
 * Unified identity abstraction over admin, contributor, and form-approver sessions.
 * Cookie issuance stays in existing auth libs; this normalizes the read/guard surface.
 */

export type PrincipalKind = "admin" | "contributor" | "form_approver";

export type PrincipalCapability =
  | "admin.manage"
  | "admin.owner"
  | "forms.admin"
  | "forms.approver"
  | "forms.coordinator"
  | "contributor.edit"
  | "viewer";

export interface Principal {
  kind: PrincipalKind;
  id: string;
  identifier: string;
  displayName: string;
  email?: string;
  role?: "owner" | "admin" | "coordinator";
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
