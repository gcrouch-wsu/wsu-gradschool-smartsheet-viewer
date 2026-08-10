/**
 * One-time migration: move/copy student portal accounts out of contributor_users into student_users.
 */

import { isDatabaseConfigEnabled, queryConfigDb } from "@/lib/config/config-db";
import { deleteContributorUser } from "@/lib/contributor-auth";
import { normalizeContributorEmail } from "@/lib/contributor-utils";
import { insertStudentUserFromHashes } from "@/lib/forms/student-users";
import { resolveContributorAccountKinds } from "@/lib/resolve-contributor-account-kinds";

const MIGRATION_ID = "app_migrate_student_accounts_v1";

let migratePromise: Promise<void> | null = null;

async function isMigrationApplied(): Promise<boolean> {
  const { rows } = await queryConfigDb<{ id: string }>(
    `SELECT id FROM schema_migrations WHERE id = $1 LIMIT 1`,
    [MIGRATION_ID],
  );
  return Boolean(rows[0]);
}

async function markMigrationApplied(): Promise<void> {
  await queryConfigDb(`INSERT INTO schema_migrations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [
    MIGRATION_ID,
  ]);
}

/**
 * Classify contributor_users by sheet membership and populate student_users.
 * Safe to call repeatedly; no-op after first successful run.
 */
export async function ensureStudentAccountsMigrated(): Promise<void> {
  if (!isDatabaseConfigEnabled()) return;

  if (!migratePromise) {
    migratePromise = (async () => {
      try {
        if (await isMigrationApplied()) return;

        const { rows } = await queryConfigDb<{
          id: string;
          email: string;
          password_hash: string;
          password_salt: string;
          created_at: string | Date;
          updated_at: string | Date;
        }>(
          `SELECT id, email, password_hash, password_salt, created_at, updated_at
           FROM contributor_users
           ORDER BY email`,
        );

        if (rows.length === 0) {
          await markMigrationApplied();
          return;
        }

        const emails = rows.map((row) => normalizeContributorEmail(row.email));
        const kinds = await resolveContributorAccountKinds(emails);

        for (const row of rows) {
          const email = normalizeContributorEmail(row.email);
          const kind = kinds.get(email) ?? "none";
          const createdAt =
            row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at);
          const updatedAt =
            row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at);

          if (kind === "student" || kind === "both") {
            await insertStudentUserFromHashes({
              email,
              passwordHash: row.password_hash,
              passwordSalt: row.password_salt,
              createdAt,
              updatedAt,
            });
          }

          if (kind === "student") {
            await deleteContributorUser(row.id);
          }
        }

        await markMigrationApplied();
      } catch (error) {
        migratePromise = null;
        throw error;
      }
    })();
  }

  await migratePromise;
}
