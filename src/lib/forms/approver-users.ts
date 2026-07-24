import {
  getFormApproverConfigurationError,
  getFormApproverUserByEmail,
  hashFormApproverPassword,
  validateFormApproverPassword,
} from "@/lib/forms/approver-auth";
import { ensureFormsTables, queryFormsDb } from "@/lib/forms/db";

export interface FormApproverSummary {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

interface FormApproverUserDbRow {
  id: string;
  email: string;
  created_at: string | Date;
  updated_at: string | Date;
}

function toSummary(row: FormApproverUserDbRow): FormApproverSummary {
  return {
    id: row.id,
    email: row.email,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : new Date(row.created_at).toISOString(),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : new Date(row.updated_at).toISOString(),
  };
}

export async function listFormApprovers(): Promise<FormApproverSummary[]> {
  const configurationError = getFormApproverConfigurationError();
  if (configurationError) throw new Error(configurationError);
  await ensureFormsTables();
  const { rows } = await queryFormsDb<FormApproverUserDbRow>(
    `SELECT id, email, created_at, updated_at FROM form_approver_users ORDER BY email`,
  );
  return rows.map(toSummary);
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

  const { passwordHash, passwordSalt } = hashFormApproverPassword(password);
  await ensureFormsTables();
  const { rows } = await queryFormsDb<FormApproverUserDbRow>(
    `INSERT INTO form_approver_users (email, password_hash, password_salt)
     VALUES ($1, $2, $3)
     RETURNING id, email, created_at, updated_at`,
    [normalizedEmail, passwordHash, passwordSalt],
  );
  return toSummary(rows[0]!);
}

export async function deleteFormApproverAccount(id: string) {
  const configurationError = getFormApproverConfigurationError();
  if (configurationError) throw new Error(configurationError);
  await ensureFormsTables();
  const { rowCount } = await queryFormsDb(`DELETE FROM form_approver_users WHERE id = $1`, [id]);
  if (!rowCount) throw new Error("Approver account not found.");
}

export async function resetFormApproverPassword(id: string, password: string) {
  const configurationError = getFormApproverConfigurationError();
  if (configurationError) throw new Error(configurationError);

  const passwordError = validateFormApproverPassword(password);
  if (passwordError) throw new Error(passwordError);

  const { passwordHash, passwordSalt } = hashFormApproverPassword(password);
  await ensureFormsTables();
  const { rowCount } = await queryFormsDb(
    `UPDATE form_approver_users
     SET password_hash = $2, password_salt = $3, updated_at = now()
     WHERE id = $1`,
    [id, passwordHash, passwordSalt],
  );
  if (!rowCount) throw new Error("Approver account not found.");
}
