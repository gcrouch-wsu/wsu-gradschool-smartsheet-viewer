/**
 * Audit trail for critical admin/forms actions.
 * Uses Postgres when DATABASE_URL is set; otherwise appends to config/audit/events.jsonl.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { isDatabaseConfigEnabled, queryConfigDb } from "@/lib/config/config-db";
import type { Principal } from "@/lib/identity";

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

function fileAuditPath() {
  return join(process.cwd(), "config", "audit", "events.jsonl");
}

export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    if (isDatabaseConfigEnabled()) {
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
      return;
    }

    await mkdir(join(process.cwd(), "config", "audit"), { recursive: true });
    const event: AuditEvent = {
      ...input,
      id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    await appendFile(fileAuditPath(), `${JSON.stringify(event)}\n`, "utf8");
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

  try {
    const { readFile } = await import("node:fs/promises");
    const raw = await readFile(fileAuditPath(), "utf8");
    const events = raw
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as AuditEvent)
      .reverse();
    return events
      .filter((e) => {
        if (options?.actorId && e.actorId !== options.actorId) return false;
        if (options?.resourceType && e.resourceType !== options.resourceType) return false;
        if (options?.resourceId && e.resourceId !== options.resourceId) return false;
        return true;
      })
      .slice(0, limit);
  } catch {
    return [];
  }
}
