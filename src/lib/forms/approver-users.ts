import {
  getFormApproverConfigurationError,
  getFormApproverUserByEmail,
  validateFormApproverPassword,
} from "@/lib/forms/approver-auth";
import {
  createOrUpdateUserWithRole,
  deletePlatformUser,
  getPlatformUserById,
  listPlatformUsers,
  setUserRoles,
  updatePlatformUserPassword,
  type AssignablePlatformRole,
} from "@/lib/platform-users";

export interface FormApproverSummary {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export async function listFormApprovers(): Promise<FormApproverSummary[]> {
  const configurationError = getFormApproverConfigurationError();
  if (configurationError) throw new Error(configurationError);
  const users = await listPlatformUsers({ role: "approver" });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  }));
}

export async function createFormApproverAccount(email: string, password: string) {
  const configurationError = getFormApproverConfigurationError();
  if (configurationError) throw new Error(configurationError);

  const passwordError = validateFormApproverPassword(password);
  if (passwordError) throw new Error(passwordError);

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Email is required.");

  const existing = await getFormApproverUserByEmail(normalizedEmail);
  if (existing) throw new Error("An approver account already exists for this email.");

  try {
    const user = await createOrUpdateUserWithRole(normalizedEmail, password, "approver");
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "ACCOUNT_EXISTS") {
      throw new Error("An approver account already exists for this email.");
    }
    throw error;
  }
}

export async function deleteFormApproverAccount(id: string) {
  const configurationError = getFormApproverConfigurationError();
  if (configurationError) throw new Error(configurationError);
  const user = await getPlatformUserById(id);
  if (!user) throw new Error("Approver account not found.");
  const remaining = user.roles.filter((r) => r !== "approver") as AssignablePlatformRole[];
  if (remaining.length === 0) {
    await deletePlatformUser(id);
  } else {
    await setUserRoles(id, remaining);
  }
}

export async function resetFormApproverPassword(id: string, password: string) {
  const configurationError = getFormApproverConfigurationError();
  if (configurationError) throw new Error(configurationError);

  const passwordError = validateFormApproverPassword(password);
  if (passwordError) throw new Error(passwordError);

  const user = await getPlatformUserById(id);
  if (!user) throw new Error("Approver account not found.");
  await updatePlatformUserPassword(id, password);
}
