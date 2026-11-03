/**
 * Shared role/capability constants safe for client and server bundles.
 */
import type { PrincipalCapability } from "@/lib/identity/principal";
import type { PlatformRole } from "@/lib/identity/roles";

export const PLATFORM_ROLES = [
  "owner",
  "admin",
  "programs_team",
  "coordinator",
  "approver",
  "contributor",
  "student",
] as const satisfies readonly PlatformRole[];

export type AssignablePlatformRole = Exclude<PlatformRole, "owner" | "viewer_public" | "forms_admin">;

export const ASSIGNABLE_ROLES: readonly AssignablePlatformRole[] = [
  "admin",
  "programs_team",
  "coordinator",
  "approver",
  "contributor",
  "student",
];

/** Roles an admin may grant from Users → Add/Edit. Contributor is sheet-derived (claim). */
export const ADMIN_MANAGED_ROLES: readonly AssignablePlatformRole[] = [
  "admin",
  "programs_team",
  "coordinator",
  "approver",
  "student",
];

export const ALL_CAPABILITIES: readonly PrincipalCapability[] = [
  "admin.manage",
  "admin.owner",
  "forms.admin",
  "forms.approver",
  "forms.coordinator",
  "forms.student",
  "contributor.edit",
  "viewer",
];

export const STAFF_ROLES: readonly AssignablePlatformRole[] = [
  "admin",
  "programs_team",
  "coordinator",
  "approver",
];

export const OWNER_LOCKED_CAPABILITIES: readonly PrincipalCapability[] = ["admin.owner", "admin.manage"];

/** Student portal belongs only to the student role; staff cannot grant or remove it here. */
export const STUDENT_PORTAL_CAPABILITY: PrincipalCapability = "forms.student";

export function isStudentPortalCapabilityLocked(roleId: string, capability: PrincipalCapability): boolean {
  return capability === STUDENT_PORTAL_CAPABILITY;
}

/** Force forms.student on for student, off for every other role. */
export function applyStudentPortalCapabilityLock(
  roleId: string,
  capabilities: readonly PrincipalCapability[],
): PrincipalCapability[] {
  const next = capabilities.filter((c) => c !== STUDENT_PORTAL_CAPABILITY);
  if (roleId === "student") {
    next.push(STUDENT_PORTAL_CAPABILITY);
  }
  return next;
}

export interface PlatformUserSummary {
  id: string;
  email: string;
  displayName?: string;
  isActive: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
  roles: PlatformRole[];
}

export interface RoleDefinition {
  id: PlatformRole;
  label: string;
  description?: string;
  sortOrder: number;
}

export interface RolePermissionMatrix {
  roles: RoleDefinition[];
  capabilities: PrincipalCapability[];
  matrix: Record<string, Record<string, boolean>>;
}
