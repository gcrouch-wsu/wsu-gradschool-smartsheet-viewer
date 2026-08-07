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
  | "coordinator"
  | "programs_team"
  | "contributor"
  | "student"
  | "viewer_public";

const ROLE_CAPABILITIES: Record<PlatformRole, PrincipalCapability[]> = {
  owner: ["admin.manage", "admin.owner", "forms.admin", "forms.approver", "contributor.edit", "viewer"],
  admin: ["admin.manage", "forms.admin", "forms.approver", "contributor.edit", "viewer"],
  programs_team: ["admin.manage", "forms.admin", "forms.approver", "contributor.edit", "viewer"],
  forms_admin: ["forms.admin", "forms.approver", "viewer"],
  approver: ["forms.approver", "viewer"],
  coordinator: ["forms.coordinator", "forms.approver", "viewer"],
  contributor: ["contributor.edit"],
  student: ["forms.student", "viewer"],
  viewer_public: ["viewer"],
};

export function rolesFromPrincipal(principal: Principal): PlatformRole[] {
  if (principal.kind === "admin") {
    if (principal.role === "owner") {
      return ["owner", "admin", "forms_admin", "approver"];
    }
    if (principal.role === "coordinator") {
      return ["coordinator", "approver"];
    }
    if (principal.role === "programs_team") {
      return ["programs_team", "forms_admin", "approver"];
    }
    return ["admin", "forms_admin", "approver"];
  }
  if (principal.kind === "form_approver") {
    return ["approver"];
  }
  if (principal.kind === "contributor") {
    return ["contributor"];
  }
  if (principal.kind === "student") {
    return ["student"];
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
