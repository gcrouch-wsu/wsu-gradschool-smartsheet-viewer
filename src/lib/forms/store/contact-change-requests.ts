/** Persist contact-change (approver reroute) requests in Postgres. */

import { randomUUID } from "node:crypto";
import { ensureFormsTables, queryFormsDb } from "@/lib/forms/db";
import type { ContactFieldKind } from "@/lib/forms/contact-change";

export type ContactChangeStatus = "pending" | "approved" | "rejected";

export interface ContactChangeFieldSnapshot {
  columnId: number;
  columnTitle: string;
  columnType: string;
  kind: ContactFieldKind;
  previousDisplay: string;
  previousEmail: string;
  previousName: string;
}

export type ContactChangeRequesterKind = "student" | "staff";

export interface ContactChangeRequest {
  id: string;
  sheetId: string;
  sheetName?: string;
  rowId: number;
  rowLabel?: string;
  stageTitle: string;
  /** True when this stage is the current pending approval (notify via RESEND on approve). */
  isCurrentStage: boolean;
  fields: ContactChangeFieldSnapshot[];
  proposedName: string;
  proposedEmail: string;
  note?: string;
  status: ContactChangeStatus;
  requestedBy: { id: string; name: string; email?: string };
  /** Who proposed the reroute — students vs staff (Programs Team queue). */
  requestedByKind?: ContactChangeRequesterKind;
  requestedAt: string;
  reviewedBy?: { id: string; name: string; email?: string };
  reviewedAt?: string;
  reviewNote?: string;
}

function rowFromDb(row: {
  id: string;
  sheet_id: string;
  row_id: string | number;
  status: string;
  data: ContactChangeRequest | string;
}): ContactChangeRequest {
  const data = typeof row.data === "string" ? (JSON.parse(row.data) as ContactChangeRequest) : row.data;
  return {
    ...data,
    id: row.id,
    sheetId: row.sheet_id,
    rowId: Number(row.row_id),
    status: row.status as ContactChangeStatus,
  };
}

export async function listContactChangeRequests(options?: {
  status?: ContactChangeStatus | "all";
  sheetId?: string;
  rowId?: number;
}): Promise<ContactChangeRequest[]> {
  const status = options?.status ?? "pending";

  await ensureFormsTables();
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (status !== "all") {
    params.push(status);
    clauses.push(`status = $${params.length}`);
  }
  if (options?.sheetId) {
    params.push(options.sheetId);
    clauses.push(`sheet_id = $${params.length}`);
  }
  if (options?.rowId != null) {
    params.push(options.rowId);
    clauses.push(`row_id = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const { rows } = await queryFormsDb<{
    id: string;
    sheet_id: string;
    row_id: string | number;
    status: string;
    data: ContactChangeRequest;
  }>(
    `SELECT id, sheet_id, row_id, status, data
     FROM form_contact_change_requests
     ${where}
     ORDER BY created_at DESC`,
    params,
  );
  return rows.map(rowFromDb);
}

export async function getContactChangeRequest(id: string): Promise<ContactChangeRequest | null> {
  await ensureFormsTables();
  const { rows } = await queryFormsDb<{
    id: string;
    sheet_id: string;
    row_id: string | number;
    status: string;
    data: ContactChangeRequest;
  }>("SELECT id, sheet_id, row_id, status, data FROM form_contact_change_requests WHERE id = $1", [id]);
  const row = rows[0];
  return row ? rowFromDb(row) : null;
}

export async function createContactChangeRequest(
  input: Omit<ContactChangeRequest, "id" | "status" | "requestedAt" | "reviewedBy" | "reviewedAt" | "reviewNote">,
): Promise<ContactChangeRequest> {
  const existing = await listContactChangeRequests({
    status: "pending",
    sheetId: input.sheetId,
    rowId: input.rowId,
  });
  const duplicate = existing.find((r) => r.stageTitle.toLowerCase() === input.stageTitle.toLowerCase());
  if (duplicate) {
    throw new ContactChangeStoreError(
      409,
      `A pending reroute already exists for stage "${input.stageTitle}". Wait for Programs Team review or ask them to reject it first.`,
    );
  }

  const request: ContactChangeRequest = {
    ...input,
    id: randomUUID(),
    status: "pending",
    requestedAt: new Date().toISOString(),
  };

  await ensureFormsTables();
  await queryFormsDb(
    `INSERT INTO form_contact_change_requests (id, sheet_id, row_id, status, data, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, now(), now())`,
    [request.id, request.sheetId, request.rowId, request.status, JSON.stringify(request)],
  );
  return request;
}

export async function updateContactChangeRequest(
  id: string,
  patch: Partial<Pick<ContactChangeRequest, "status" | "reviewedBy" | "reviewedAt" | "reviewNote">>,
): Promise<ContactChangeRequest> {
  const current = await getContactChangeRequest(id);
  if (!current) {
    throw new ContactChangeStoreError(404, "Contact change request not found.");
  }
  if (current.status !== "pending") {
    throw new ContactChangeStoreError(409, `Request is already ${current.status}.`);
  }

  const next: ContactChangeRequest = {
    ...current,
    ...patch,
    id: current.id,
    sheetId: current.sheetId,
    rowId: current.rowId,
  };

  await ensureFormsTables();
  await queryFormsDb(
    `UPDATE form_contact_change_requests
     SET status = $2, data = $3, updated_at = now()
     WHERE id = $1`,
    [id, next.status, JSON.stringify(next)],
  );
  return next;
}

export class ContactChangeStoreError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ContactChangeStoreError";
    this.status = status;
  }
}
