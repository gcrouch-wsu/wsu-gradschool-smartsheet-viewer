/** Persist contact-change (approver reroute) requests — DB or file fallback. */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureFormsTables, isFormsDatabaseEnabled, queryFormsDb } from "@/lib/forms/db";
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

const FORMS_CONFIG_ROOT = path.join(process.cwd(), "config", "forms");
const FILE_NAME = "contact-change-requests.json";

async function readFileStore(): Promise<ContactChangeRequest[]> {
  try {
    const raw = await readFile(path.join(FORMS_CONFIG_ROOT, FILE_NAME), "utf8");
    const trimmed = raw.replace(/^\uFEFF/, "").trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed) as { requests?: ContactChangeRequest[] } | ContactChangeRequest[];
    return Array.isArray(parsed) ? parsed : Array.isArray(parsed.requests) ? parsed.requests : [];
  } catch {
    return [];
  }
}

async function writeFileStore(requests: ContactChangeRequest[]) {
  await mkdir(FORMS_CONFIG_ROOT, { recursive: true });
  const target = path.join(FORMS_CONFIG_ROOT, FILE_NAME);
  const temp = `${target}.${process.pid}.${Date.now()}.tmp`;
  const payload = `${JSON.stringify({ requests }, null, 2)}\n`;
  await writeFile(temp, payload, "utf8");
  try {
    await rename(temp, target);
  } catch {
    await unlink(target).catch(() => undefined);
    await rename(temp, target);
  }
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

  if (isFormsDatabaseEnabled()) {
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

  let requests = await readFileStore();
  if (status !== "all") requests = requests.filter((r) => r.status === status);
  if (options?.sheetId) requests = requests.filter((r) => r.sheetId === options.sheetId);
  if (options?.rowId != null) requests = requests.filter((r) => r.rowId === options.rowId);
  return requests.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export async function getContactChangeRequest(id: string): Promise<ContactChangeRequest | null> {
  if (isFormsDatabaseEnabled()) {
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
  const requests = await readFileStore();
  return requests.find((r) => r.id === id) ?? null;
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

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    await queryFormsDb(
      `INSERT INTO form_contact_change_requests (id, sheet_id, row_id, status, data, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, now(), now())`,
      [request.id, request.sheetId, request.rowId, request.status, JSON.stringify(request)],
    );
    return request;
  }

  const requests = await readFileStore();
  requests.unshift(request);
  await writeFileStore(requests);
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

  if (isFormsDatabaseEnabled()) {
    await ensureFormsTables();
    await queryFormsDb(
      `UPDATE form_contact_change_requests
       SET status = $2, data = $3, updated_at = now()
       WHERE id = $1`,
      [id, next.status, JSON.stringify(next)],
    );
    return next;
  }

  const requests = await readFileStore();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx < 0) throw new ContactChangeStoreError(404, "Contact change request not found.");
  requests[idx] = next;
  await writeFileStore(requests);
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
