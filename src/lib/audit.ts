/**
 * Audit trail for critical admin/forms actions and admin UI activity.
 * Stored in Postgres (`audit_events`). A missing database does not fail the action being audited.
 */
import type { AdminPrincipal } from "@/lib/admin-users";
import { isDatabaseConfigEnabled, queryConfigDb } from "@/lib/config/config-db";
import { adminPrincipalToPrincipal, type Principal } from "@/lib/identity";

export interface AuditEventInput {
  actorKind: string;
  actorId: string;
  actorLabel?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEvent extends AuditEventInput {
  id: string;
  createdAt: string;
}

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    if (!isDatabaseConfigEnabled()) return;
    const { runDatabaseMigrations } = await import("@/lib/db-migrations");
    await runDatabaseMigrations();
    await queryConfigDb(
      `INSERT INTO audit_events (actor_kind, actor_id, actor_label, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.actorKind,
        input.actorId,
        input.actorLabel ?? null,
        input.action,
        input.resourceType,
        input.resourceId ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
  } catch {
    // Audit must never break the primary action.
  }
}

export function auditFromPrincipal(
  principal: Principal | null | undefined,
  action: string,
  resourceType: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  if (!principal) {
    return recordAuditEvent({
      actorKind: "anonymous",
      actorId: "anonymous",
      action,
      resourceType,
      resourceId,
      metadata,
    });
  }
  return recordAuditEvent({
    actorKind: principal.kind,
    actorId: principal.id,
    actorLabel: principal.displayName || principal.identifier,
    action,
    resourceType,
    resourceId,
    metadata,
  });
}

/** Convenience for admin API routes that already have an AdminPrincipal. */
export function auditFromAdminPrincipal(
  admin: AdminPrincipal | null | undefined,
  action: string,
  resourceType: string,
  resourceId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  return auditFromPrincipal(
    admin ? adminPrincipalToPrincipal(admin) : null,
    action,
    resourceType,
    resourceId,
    metadata,
  );
}

/** Max events accepted from one UI batch POST. */
export const UI_AUDIT_BATCH_LIMIT = 40;

export async function listAuditEvents(options?: {
  limit?: number;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
}): Promise<AuditEvent[]> {
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);

  if (isDatabaseConfigEnabled()) {
    const { runDatabaseMigrations } = await import("@/lib/db-migrations");
    await runDatabaseMigrations();
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (options?.actorId) {
      params.push(options.actorId);
      clauses.push(`actor_id = $${params.length}`);
    }
    if (options?.resourceType) {
      params.push(options.resourceType);
      clauses.push(`resource_type = $${params.length}`);
    }
    if (options?.resourceId) {
      params.push(options.resourceId);
      clauses.push(`resource_id = $${params.length}`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    params.push(limit);
    const { rows } = await queryConfigDb<{
      id: string;
      actor_kind: string;
      actor_id: string;
      actor_label: string | null;
      action: string;
      resource_type: string;
      resource_id: string | null;
      metadata: Record<string, unknown> | null;
      created_at: string | Date;
    }>(
      `SELECT id::text, actor_kind, actor_id, actor_label, action, resource_type, resource_id, metadata, created_at
       FROM audit_events ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length}`,
      params,
    );
    return rows.map((r) => ({
      id: r.id,
      actorKind: r.actor_kind,
      actorId: r.actor_id,
      actorLabel: r.actor_label ?? undefined,
      action: r.action,
      resourceType: r.resource_type,
      resourceId: r.resource_id ?? undefined,
      metadata: r.metadata ?? undefined,
      createdAt: typeof r.created_at === "string" ? r.created_at : r.created_at.toISOString(),
    }));
  }

  return [];
}
