export function isWorkflowAuthorRole(role: string | undefined | null): boolean {
  return role === "owner" || role === "admin" || role === "programs_team" || role === "coordinator";
}
