import {
  AdminAuthenticationError,
  adminAuthenticationErrorResponse,
  requireFullAdmin,
  requireOwnerAdmin,
} from "@/lib/admin-users";

export async function requireAdminApiAccess(options?: { ownerOnly?: boolean }) {
  try {
    const principal = options?.ownerOnly ? await requireOwnerAdmin() : await requireFullAdmin();
    return { principal };
  } catch (error) {
    if (error instanceof AdminAuthenticationError) {
      return { response: adminAuthenticationErrorResponse(error) };
    }

    throw error;
  }
}