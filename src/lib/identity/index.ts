export type { Principal, PrincipalCapability, PrincipalKind } from "@/lib/identity/principal";
export { principalHasAnyCapability, principalHasCapability } from "@/lib/identity/principal";
export {
  adminPrincipalToPrincipal,
  hasAdminSessionToken,
  hasApproverSessionToken,
  requirePrincipalCapabilities,
  resolveAdminPrincipal,
  resolveApproverPrincipal,
  resolveContributorPrincipal,
  resolvePrincipal,
} from "@/lib/identity/resolve";
export type { PlatformRole } from "@/lib/identity/roles";
export { capabilitiesForRoles, principalHasRole, rolesFromPrincipal } from "@/lib/identity/roles";
