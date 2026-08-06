// In-memory Smartsheet stand-in used in DEMO mode (no token, or DEMO=true).
// This lets the entire app — form, tracker, admin — run with zero setup so you
// can test every feature before wiring up a real Smartsheet account.

export const SAMPLE_SHEET_ID = "900000000000001";

interface Col {
  id: number;
  title: string;
  type: string;
  options?: string[];
  primary?: boolean;
}
interface Cell {
  columnId: number;
  value: string | boolean;
}
interface Row {
  id: number;
  createdAt: string;
  cells: Cell[];
}
interface Sheet {
  id: number;
  name: string;
  columns: Col[];
  rows: Row[];
}

let seq = 1000;
const nextId = () => ++seq;

// The sample form exercises every field type the form renderer supports, plus
// the approval-chain status columns the tracker reads.
function sampleColumns(): Col[] {
  return [
    { id: 1, title: "Full Name", type: "TEXT_NUMBER", primary: true },
    { id: 2, title: "Email", type: "TEXT_NUMBER" },
    { id: 3, title: "Department", type: "PICKLIST", options: ["Academics", "Athletics", "Facilities", "IT", "Other"] },
    { id: 4, title: "Nominee Type", type: "PICKLIST", options: ["Faculty", "Staff", "Student"] },
    { id: 5, title: "Start Date", type: "DATE" },
    { id: 6, title: "Agree to Terms", type: "CHECKBOX" },
    { id: 7, title: "Message", type: "TEXT_NUMBER" },
    // --- Approval chain (excluded from the form, shown in the tracker) ---
    { id: 8, title: "Director Status", type: "PICKLIST", options: ["Submitted", "Approved", "Declined"] },
    { id: 9, title: "Signature Authority Status", type: "PICKLIST", options: ["Submitted", "Approved", "Declined"] },
    { id: 10, title: "Academic Coordinator Status", type: "PICKLIST", options: ["Submitted", "Approved", "Declined"] },
    { id: 11, title: "Overall Stage", type: "TEXT_NUMBER" },
  ];
}

function makeRow(values: Record<number, string | boolean>, ageMs: number): Row {
  const cells: Cell[] = Object.entries(values)
    .filter(([, v]) => v !== "" && v !== undefined)
    .map(([id, v]) => ({ columnId: Number(id), value: v }));
  return { id: nextId(), createdAt: new Date(Date.now() - ageMs).toISOString(), cells };
}

// Seeded submissions at different points in the approval chain so the tracker
// shows a complete one, an in-progress one, a just-started one, and a declined one.
function seedRows(): Row[] {
  return [
    makeRow(
      { 1: "Jane Cougar", 2: "jane.cougar@wsu.edu", 3: "Academics", 4: "Faculty", 5: "2026-05-01", 6: true, 7: "Outstanding teaching record.", 8: "Approved", 9: "Approved", 10: "Approved", 11: "Complete" },
      9 * 864e5,
    ),
    makeRow(
      { 1: "Sam Pullman", 2: "sam.pullman@wsu.edu", 3: "Athletics", 4: "Staff", 5: "2026-05-12", 6: true, 7: "Strong service contribution.", 8: "Approved", 9: "Submitted", 11: "In review" },
      4 * 864e5,
    ),
    makeRow(
      { 1: "Pat Crimson", 2: "pat.crimson@wsu.edu", 3: "IT", 4: "Staff", 5: "2026-06-02", 6: true, 7: "Led the systems migration.", 8: "Submitted", 11: "In review" },
      2 * 864e5,
    ),
    makeRow(
      { 1: "Alex Palouse", 2: "alex.palouse@wsu.edu", 3: "Facilities", 4: "Student", 5: "2026-06-15", 6: true, 7: "Volunteer of the year.", 8: "Declined", 11: "Declined" },
      1 * 864e5,
    ),
  ];
}

const sheets = new Map<string, Sheet>();
sheets.set(SAMPLE_SHEET_ID, {
  id: Number(SAMPLE_SHEET_ID),
  name: "WSU Nomination Form (Sample)",
  columns: sampleColumns(),
  rows: seedRows(),
});

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const get = (id: string | number): Sheet => sheets.get(String(id)) ?? sheets.get(SAMPLE_SHEET_ID)!;

export function mockListSheets() {
  return Array.from(sheets.values()).map((s) => ({ id: s.id, name: s.name }));
}

export function mockGetSheet(id: string | number) {
  return clone(get(id));
}

export function mockAddRow(id: string | number, cells: Cell[]) {
  const s = get(id);
  const extra: Cell[] = [];
  const dir = s.columns.find((c) => /director status/i.test(c.title));
  const overall = s.columns.find((c) => c.title.toLowerCase() === "overall stage");
  if (dir) extra.push({ columnId: dir.id, value: "Submitted" });
  if (overall) extra.push({ columnId: overall.id, value: "In review" });
  const row: Row = { id: nextId(), createdAt: new Date().toISOString(), cells: [...cells, ...extra] };
  s.rows.push(row);
  return { result: [{ id: row.id }] };
}

export function mockCreateSheet(name: string, columns: Omit<Col, "id">[]) {
  const id = nextId();
  const cols: Col[] = columns.map((c, i) => ({ id: i + 1, ...c }));
  sheets.set(String(id), { id, name, columns: cols, rows: [] });
  return { result: { id, name } };
}

export function mockCopySheet(templateId: string | number, name: string) {
  const src = get(templateId);
  const id = nextId();
  sheets.set(String(id), { id, name, columns: clone(src.columns), rows: [] });
  return { result: { id, name } };
}

export function mockListAutomationRules() {
  return [
    { name: "Request Nomination from Director", enabled: true, action: { type: "REQUEST_UPDATE", recipients: [{ email: "director@wsu.edu" }] }, createdBy: { name: "Graduate School" } },
    { name: "Send PDF to Academic Coordinator", enabled: true, action: { type: "REQUEST_UPDATE", recipients: [{ email: "coordinator@wsu.edu" }] }, createdBy: { name: "Graduate School" } },
    { name: "Notify team on new submission", enabled: false, action: { type: "NOTIFICATION", recipients: [{ email: "team@wsu.edu" }] }, disabledReason: "NO_POTENTIAL_RECIPIENTS", createdBy: { name: "Graduate School" } },
  ];
}

function signatoryName(title: string): string {
  if (/director/i.test(title)) return "Dana Director";
  if (/signature/i.test(title)) return "Sam Signatory";
  if (/coordinator/i.test(title)) return "Casey Coordinator";
  return "Workflow";
}

export function mockCellHistory(sheetId: string | number, rowId: string | number, columnId: string | number) {
  const s = get(sheetId);
  const row = s.rows.find((r) => r.id === Number(rowId));
  if (!row) return [];
  const cell = row.cells.find((c) => c.columnId === Number(columnId));
  if (!cell || cell.value === "" || cell.value === undefined) return [];
  const col = s.columns.find((c) => c.id === Number(columnId));
  const idx = s.columns.findIndex((c) => c.id === Number(columnId));
  const base = new Date(row.createdAt).getTime();
  const modifiedAt = new Date(base + Math.max(1, idx - 6) * 18 * 36e5).toISOString();
  return [
    {
      value: cell.value,
      displayValue: String(cell.value),
      modifiedAt,
      modifiedBy: { name: signatoryName(col?.title ?? "") },
    },
  ];
}

interface AttachmentRec {
  id: number;
  name: string;
  mimeType?: string;
  sizeInKb?: number;
  rowId?: number;
}
interface DiscussionRec {
  id: number;
  comments: { id: number; text: string; createdAt: string; createdBy: { name: string; email?: string } }[];
}
interface ShareRec {
  id: string;
  type: string;
  email: string;
  name: string;
  accessLevel: string;
}

const attachments = new Map<string, AttachmentRec[]>();
const discussions = new Map<string, DiscussionRec[]>();
const shares = new Map<string, ShareRec[]>();
let attachSeq = 5000;
let discussSeq = 6000;

function rowKey(sheetId: string | number, rowId: string | number) {
  return `${sheetId}:${rowId}`;
}

export function mockGetRow(sheetId: string | number, rowId: string | number) {
  const s = get(sheetId);
  const row = s.rows.find((r) => r.id === Number(rowId));
  if (!row) throw Object.assign(new Error("Row not found"), { status: 404 });
  return clone(row);
}

export function mockUpdateRows(
  sheetId: string | number,
  rows: {
    id: number;
    cells: Array<{ columnId: number; value?: string | boolean; objectValue?: unknown }>;
  }[],
) {
  const s = get(sheetId);
  for (const upd of rows) {
    const row = s.rows.find((r) => r.id === upd.id);
    if (!row) continue;
    for (const c of upd.cells) {
      const value =
        "value" in c && c.value !== undefined
          ? c.value
          : c.objectValue != null
            ? JSON.stringify(c.objectValue)
            : "";
      const existing = row.cells.find((x) => x.columnId === c.columnId);
      if (existing) existing.value = value as string | boolean;
      else row.cells.push({ columnId: c.columnId, value: value as string | boolean });
    }
  }
  return { message: "SUCCESS", result: rows.map((r) => ({ id: r.id })) };
}

export function mockDeleteRows(sheetId: string | number, rowIds: (string | number)[]) {
  const s = get(sheetId);
  const ids = new Set(rowIds.map(Number));
  s.rows = s.rows.filter((r) => !ids.has(r.id));
  return { message: "SUCCESS", result: [...ids] };
}

export function mockSendUpdateRequest(_sheetId: string | number, _payload: { rowIds: number[]; columnIds: number[]; message?: string; sendTo?: { email: string; }[]; }) {
  return { message: "SUCCESS", result: { id: nextId() } };
}

export function mockListAttachments(sheetId: string | number, rowId?: string | number) {
  if (rowId) return clone(attachments.get(rowKey(sheetId, rowId)) ?? []);
  const all: AttachmentRec[] = [];
  for (const [k, v] of attachments) {
    if (k.startsWith(`${sheetId}:`)) all.push(...v);
  }
  return clone(all);
}

export function mockAttachFile(sheetId: string | number, rowId: string | number, fileName: string) {
  const key = rowKey(sheetId, rowId);
  const list = attachments.get(key) ?? [];
  const rec: AttachmentRec = { id: ++attachSeq, name: fileName, mimeType: "application/octet-stream", sizeInKb: 128, rowId: Number(rowId) };
  list.push(rec);
  attachments.set(key, list);
  return { result: rec };
}

export function mockGetAttachment(attachmentId: string | number) {
  for (const list of attachments.values()) {
    const a = list.find((x) => x.id === Number(attachmentId));
    if (a) return { ...clone(a), url: `https://demo.local/attachments/${a.id}` };
  }
  throw Object.assign(new Error("Attachment not found"), { status: 404 });
}

export function mockListDiscussions(sheetId: string | number, rowId: string | number) {
  return clone(discussions.get(rowKey(sheetId, rowId)) ?? []);
}

export function mockAddDiscussion(sheetId: string | number, rowId: string | number, text: string) {
  const key = rowKey(sheetId, rowId);
  const list = discussions.get(key) ?? [];
  const d: DiscussionRec = {
    id: ++discussSeq,
    comments: [{ id: ++discussSeq, text, createdAt: new Date().toISOString(), createdBy: { name: "Demo User", email: "demo@wsu.edu" } }],
  };
  list.push(d);
  discussions.set(key, list);
  return { result: d };
}

export function mockListWorkspaces() {
  return [{ id: 1, name: "WSU Graduate School", permalink: "https://demo.local/ws/1" }];
}

export function mockListFolderChildren(_folderId: string | number) {
  return [
    { id: 101, name: "Forms", type: "folder" },
    { id: Number(SAMPLE_SHEET_ID), name: "WSU Nomination Form (Sample)", type: "sheet" },
  ];
}

export function mockGetSheetPath(sheetId: string | number) {
  return {
    path: [
      { id: 1, name: "WSU Graduate School", type: "workspace" },
      { id: 101, name: "Forms", type: "folder" },
      { id: Number(sheetId), name: get(sheetId).name, type: "sheet" },
    ],
  };
}

export function mockMoveSheet(_sheetId: string | number, _folderId: string | number) {
  return { message: "SUCCESS" };
}

export function mockShareSheet(sheetId: string | number, email: string, accessLevel: string) {
  const key = String(sheetId);
  const list = shares.get(key) ?? [];
  const rec: ShareRec = { id: String(nextId()), type: "USER", email, name: email.split("@")[0], accessLevel };
  list.push(rec);
  shares.set(key, list);
  return { result: [rec] };
}

export function mockListShares(sheetId: string | number) {
  return clone(shares.get(String(sheetId)) ?? []);
}

export function mockListUsers() {
  return [
    { id: 1, email: "director@wsu.edu", name: "Dana Director" },
    { id: 2, email: "coordinator@wsu.edu", name: "Casey Coordinator" },
  ];
}

export function mockListGroups() {
  return [
    { id: 10, name: "WSU Form Admins" },
    { id: 11, name: "WSU Approvers" },
  ];
}

export function mockListTemplates() {
  return [{ id: 999, name: "Nomination Template", accessLevel: "ORG" }];
}

export function mockSearch(query: string) {
  const q = query.toLowerCase();
  const results: { objectId: number; objectType: string; text: string; parentObjectName?: string }[] = [];
  for (const s of sheets.values()) {
    if (s.name.toLowerCase().includes(q)) {
      results.push({ objectId: s.id, objectType: "sheet", text: s.name });
    }
    for (const r of s.rows) {
      const text = r.cells.map((c) => String(c.value)).join(" ");
      if (text.toLowerCase().includes(q)) {
        results.push({ objectId: r.id, objectType: "row", text, parentObjectName: s.name });
      }
    }
  }
  return results;
}

export function mockListEvents(_since: string | undefined) {
  return { data: [], morePolling: false, lastEventId: "demo-0" };
}

export function mockListWebhooks() {
  return [{ id: 1, name: "WSU Form Sync", enabled: true, callbackUrl: "https://demo.local/api/webhooks/smartsheet", scopeObjectId: Number(SAMPLE_SHEET_ID) }];
}

export function mockCreateWebhook(callbackUrl: string, scopeObjectId: number) {
  return { result: { id: nextId(), callbackUrl, scopeObjectId, enabled: false } };
}

export function mockUpdateWebhook(_webhookId: number, enabled: boolean) {
  return { result: { enabled } };
}

export function mockDeleteWebhook(webhookId: number) {
  return { result: { id: webhookId } };
}

export function mockListColumns(sheetId: string | number) {
  return clone(get(sheetId).columns);
}

export function mockAddColumns(sheetId: string | number, columns: Omit<Col, "id">[]) {
  const s = get(sheetId);
  const maxId = Math.max(0, ...s.columns.map((c) => c.id));
  const added = columns.map((c, i) => ({ id: maxId + i + 1, ...c }));
  s.columns.push(...added);
  return { result: added };
}

export function mockUpdateColumn(sheetId: string | number, columnId: number, updates: Partial<Col>) {
  const s = get(sheetId);
  const col = s.columns.find((c) => c.id === columnId);
  if (!col) throw Object.assign(new Error("Column not found"), { status: 404 });
  Object.assign(col, updates);
  return { result: col };
}

export function mockDeleteColumn(sheetId: string | number, columnId: number) {
  const s = get(sheetId);
  s.columns = s.columns.filter((c) => c.id !== columnId);
  return { message: "SUCCESS" };
}

export function mockCopyRows(rowIds: number[], toSheetId: number) {
  return { result: rowIds.map((id) => ({ id, sheetId: toSheetId })) };
}

export function mockMoveRows(sheetId: string | number, rowIds: number[], toSheetId: number) {
  const from = get(sheetId);
  const to = get(toSheetId);
  const ids = new Set(rowIds);
  const moving = from.rows.filter((r) => ids.has(r.id));
  from.rows = from.rows.filter((r) => !ids.has(r.id));
  to.rows.push(...moving);
  return { message: "SUCCESS" };
}

export function mockSendRowEmail(_sheetId: string | number, _rowIds: number[]) {
  return { message: "SUCCESS" };
}

export function mockListReports() {
  return [{ id: 2001, name: "Submissions Summary", permalink: "https://demo.local/reports/2001" }];
}

export function mockGetReport(reportId: string | number) {
  return { id: Number(reportId), name: "Submissions Summary", rows: [] };
}

export function mockCreateReport(body: { name?: string }) {
  return { result: { id: nextId(), name: body.name ?? "New Report" } };
}

export function mockUpdateReport(reportId: string | number, body: Record<string, unknown>) {
  return { result: { id: Number(reportId), ...body } };
}

export function mockDeleteReport(_reportId: string | number) {
  return { message: "SUCCESS" };
}

export function mockListSights() {
  return [{ id: 3001, name: "Approval Dashboard", permalink: "https://demo.local/sights/3001" }];
}

export function mockGetSight(sightId: string | number) {
  return { id: Number(sightId), name: "Approval Dashboard", widgets: [] };
}

export function mockListForms(sheetId: string | number) {
  return [{ id: 1, name: `${get(sheetId).name} (Native)`, url: "https://demo.local/forms/1", accessLevel: "ORG" }];
}

export function mockGetForm(sheetId: string | number, formId: string | number) {
  return { id: Number(formId), name: `${get(sheetId).name} (Native)`, url: "https://demo.local/forms/1" };
}
