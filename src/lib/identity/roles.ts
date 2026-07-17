/**
 * Explicit platform roles mapped from existing cookie sessions.
 * Effective permissions match today's access matrix.
 */
import type { Principal, PrincipalCapability } from "@/lib/identity/principal";

export type PlatformRole =
  | "owner"
  | "admin"
  | "forms_admin"
  | "approver"
  | "contributor"
  | "viewer_public";

const ROLE_CAPABILITIES: Record<PlatformRole, PrincipalCapability[]> = {
  owner: ["admin.manage", "admin.owner", "forms.admin", "forms.approver", "contributor.edit", "viewer"],
  admin: ["admin.manage", "forms.admin", "forms.approver", "contributor.edit", "viewer"],
  forms_admin: ["forms.admin", "forms.approver", "viewer"],
  approver: ["forms.approver", "viewer"],
  contributor: ["contributor.edit"],
  viewer_public: ["viewer"],
};

export function rolesFromPrincipal(principal: Principal): PlatformRole[] {
  if (principal.kind === "admin") {
    return principal.role === "owner" ? ["owner", "admin", "forms_admin", "approver"] : ["admin", "forms_admin", "approver"];
  }
  if (principal.kind === "form_approver") {
    return ["approver"];
  }
  if (principal.kind === "contributor") {
    return ["contributor"];
  }
  return ["viewer_public"];
}

export function capabilitiesForRoles(roles: PlatformRole[]): PrincipalCapability[] {
  const set = new Set<PrincipalCapability>();
  for (const role of roles) {
    for (const cap of ROLE_CAPABILITIES[role]) {
      set.add(cap);
    }
  }
  return [...set];
}

export function principalHasRole(principal: Principal, role: PlatformRole): boolean {
  return rolesFromPrincipal(principal).includes(role);
}
