"use client";

import { useEffect, useMemo, useState } from "react";
import { ADMIN_PASSWORD_POLICY_MESSAGE } from "@/lib/admin-auth";

interface FormEntry {
  id: string;
  name: string;
  createdAt: string;
  source: "template" | "scratch" | "imported" | "sample";
}

interface SheetOption {
  id: number;
  name: string;
}

interface Rule {
  name?: string;
  enabled?: boolean;
  action?: { type?: string; recipients?: { email?: string; recipientColumnId?: number }[] };
  actionType?: string;
  disabledReason?: string;
  createdBy?: { name?: string };
}

interface ApproverSummary {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

type AdminTab = "forms" | "org" | "webhooks" | "schema" | "platform" | "approvers";

const SOURCE_LABEL: Record<FormEntry["source"], string> = {
  template: "Cloned",
  scratch: "From scratch",
  imported: "Added",
  sample: "Sample",
};

export default function ManagePage() {
  const [tab, setTab] = useState<AdminTab>("forms");
  const [forms, setForms] = useState<FormEntry[]>([]);
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [formsError, setFormsError] = useState("");
  const [addId, setAddId] = useState("");
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [mode, setMode] = useState<"template" | "scratch">("template");
  const [sheets, setSheets] = useState<SheetOption[]>([]);
  const [sheetsLive, setSheetsLive] = useState(false);
  const [sheetsError, setSheetsError] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [newName, setNewName] = useState("");
  const [destinationFolderId, setDestinationFolderId] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [autoNotice, setAutoNotice] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);
  const [paths, setPaths] = useState<Record<string, string>>({});
  const [workspaces, setWorkspaces] = useState<{ id: number; name: string }[]>([]);
  const [folderChildren, setFolderChildren] = useState<{ id: number; name: string; type: string }[]>([]);
  const [shareSheetEmail, setShareSheetEmail] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [webhookInfo, setWebhookInfo] = useState<{ webhooks?: unknown[]; state?: { lastWebhookAt?: string } } | null>(null);
  const [columns, setColumns] = useState<{ id: number; title: string; type: string }[]>([]);
  const [newColTitle, setNewColTitle] = useState("");
  const [reports, setReports] = useState<{ id: number; name: string; permalink?: string }[]>([]);
  const [dashboards, setDashboards] = useState<{ id: number; name: string; permalink?: string }[]>([]);
  const [nativeForms, setNativeForms] = useState<{ id: number; name: string; url?: string }[]>([]);
  const [rowToolRowId, setRowToolRowId] = useState("");
  const [rowToolSheetId, setRowToolSheetId] = useState("");
  const [rowToolMsg, setRowToolMsg] = useState("");
  const [approvers, setApprovers] = useState<ApproverSummary[]>([]);
  const [approverEmail, setApproverEmail] = useState("");
  const [approverPassword, setApproverPassword] = useState("");
  const [approverMsg, setApproverMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [resetPasswordId, setResetPasswordId] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  async function loadForms() {
    try {
      const r = await fetch("/api/forms/registry");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Could not load forms.");
      setForms(d.forms);
      setActiveId(String(d.activeSheetId || ""));
    } catch (e: unknown) {
      setFormsError(e instanceof Error ? e.message : "Could not load forms.");
    }
  }

  async function loadSheets() {
    try {
      const r = await fetch("/api/forms/platform/sheets");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Could not load sheets from Smartsheet.");
      setSheets(d.sheets ?? []);
      setSheetsLive(!d.demo);
      setSheetsError("");
      if (d.defaultTemplateId) setTemplateId(String(d.defaultTemplateId));
    } catch (e: unknown) {
      setSheets([]);
      setSheetsError(e instanceof Error ? e.message : "Could not load sheets.");
    }
  }

  useEffect(() => {
    loadForms();
    loadSheets();
  }, []);

  useEffect(() => {
    if (!activeId) return;
    fetch(`/api/forms/platform/sheets/${activeId}/path`)
      .then((r) => r.json())
      .then((d) => {
        if (d.path) {
          const label = (d.path as { name: string }[]).map((n) => n.name).join(" / ");
          setPaths((p) => ({ ...p, [activeId]: label }));
        }
      })
      .catch(() => null);
  }, [activeId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return forms;
    return forms.filter((f) => f.name.toLowerCase().includes(q) || String(f.id).includes(q));
  }, [forms, query]);

  const registeredIds = useMemo(() => new Set(forms.map((f) => String(f.id))), [forms]);
  const addableSheets = useMemo(
    () => sheets.filter((s) => !registeredIds.has(String(s.id))),
    [sheets, registeredIds],
  );

  async function useForm(id: string) {
    try {
      const r = await fetch("/api/forms/registry/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Could not switch form.");
      await loadForms();
    } catch (e: unknown) {
      setFormsError(e instanceof Error ? e.message : "Could not switch form.");
    }
  }

  async function addExisting() {
    setAddMsg(null);
    const id = addId.trim();
    if (!id) return setAddMsg({ ok: false, text: "Select a sheet from the list." });
    try {
      const r = await fetch("/api/forms/registry/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Could not add that sheet.");
      setAddId("");
      setAddMsg({ ok: true, text: `Added "${d.sheet.name}" and set it active.` });
      await loadForms();
    } catch (e: unknown) {
      setAddMsg({ ok: false, text: e instanceof Error ? e.message : "Could not add sheet." });
    }
  }

  async function createForm() {
    setCreateMsg(null);
    if (mode === "template" && !templateId) return setCreateMsg({ ok: false, text: "Choose a template sheet first." });
    setCreating(true);
    try {
      const r = await fetch("/api/forms/registry/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          templateId,
          newName,
          destinationFolderId: destinationFolderId || undefined,
          shareEmails: shareEmail ? [shareEmail] : [],
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Create failed.");
      setNewName("");
      setShareEmail("");
      setCreateMsg({ ok: true, text: `Created "${d.sheet.name}" and set it active.${d.note ? " " + d.note : ""}` });
      await loadForms();
    } catch (e: unknown) {
      setCreateMsg({ ok: false, text: e instanceof Error ? e.message : "Create failed." });
    } finally {
      setCreating(false);
    }
  }

  async function loadAutomations() {
    setAutoLoading(true);
    setRules(null);
    setAutoNotice("");
    try {
      const r = await fetch("/api/forms/platform/automations");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Could not load automations.");
      setRules(d.rules);
      setAutoNotice(d.notice || "");
    } catch (e: unknown) {
      setAutoNotice("");
      setRules([]);
      setFormsError(e instanceof Error ? e.message : "Could not load automations.");
    } finally {
      setAutoLoading(false);
    }
  }

  async function loadOrg() {
    try {
      const wr = await fetch("/api/forms/platform/workspaces");
      const wd = await wr.json();
      if (wr.ok) setWorkspaces(wd.workspaces ?? []);
      if (destinationFolderId) {
        const fr = await fetch(`/api/forms/platform/folders/${destinationFolderId}/children`);
        const fd = await fr.json();
        if (fr.ok) setFolderChildren(fd.children ?? []);
      }
    } catch {
      /* ignore */
    }
  }

  async function shareActiveSheet() {
    setShareMsg("");
    if (!activeId || !shareSheetEmail.trim()) return;
    try {
      const r = await fetch(`/api/forms/platform/sheets/${activeId}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: shareSheetEmail.trim(), accessLevel: "EDITOR" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Share failed.");
      setShareMsg("Shared successfully.");
      setShareSheetEmail("");
    } catch (e: unknown) {
      setShareMsg(e instanceof Error ? e.message : "Share failed.");
    }
  }

  async function loadWebhooks() {
    const r = await fetch("/api/forms/webhooks");
    const d = await r.json();
    if (r.ok) setWebhookInfo(d);
  }

  async function registerWebhook() {
    const r = await fetch("/api/forms/webhooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const d = await r.json();
    if (!r.ok) setFormsError(d.error || d.message || "Webhook registration failed.");
    else await loadWebhooks();
  }

  async function loadSchema() {
    if (!activeId) return;
    const r = await fetch(`/api/forms/platform/sheets/${activeId}/columns`);
    const d = await r.json();
    if (r.ok) setColumns(d.columns ?? []);
  }

  async function addColumn() {
    if (!activeId || !newColTitle.trim()) return;
    const r = await fetch(`/api/forms/platform/sheets/${activeId}/columns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columns: [{ title: newColTitle.trim(), type: "TEXT_NUMBER" }] }),
    });
    const d = await r.json();
    if (!r.ok) setFormsError(d.error || d.message || "Could not add column.");
    else {
      setNewColTitle("");
      await loadSchema();
    }
  }

  async function loadPlatform() {
    if (!activeId) return;
    const [rr, dr, fr] = await Promise.all([
      fetch("/api/forms/platform/reports").then((r) => r.json()),
      fetch("/api/forms/platform/dashboards").then((r) => r.json()),
      fetch(`/api/forms/platform/sheets/${activeId}/forms`).then((r) => r.json()),
    ]);
    setReports(rr.reports ?? []);
    setDashboards(dr.dashboards ?? []);
    setNativeForms(fr.forms ?? []);
  }

  async function copyRowTool() {
    setRowToolMsg("");
    if (!activeId || !rowToolRowId || !rowToolSheetId) return;
    try {
      const r = await fetch(`/api/forms/platform/sheets/${activeId}/rows/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIds: [Number(rowToolRowId)], toSheetId: Number(rowToolSheetId) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Copy failed.");
      setRowToolMsg("Row copied.");
    } catch (e: unknown) {
      setRowToolMsg(e instanceof Error ? e.message : "Copy failed.");
    }
  }

  async function loadApprovers() {
    setApproverMsg(null);
    try {
      const r = await fetch("/api/forms/registry/approvers");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Could not load approvers.");
      setApprovers(d.approvers ?? []);
    } catch (e: unknown) {
      setApproverMsg({ ok: false, text: e instanceof Error ? e.message : "Could not load approvers." });
    }
  }

  async function createApprover() {
    setApproverMsg(null);
    if (!approverEmail.trim() || !approverPassword) {
      setApproverMsg({ ok: false, text: "Email and password are required." });
      return;
    }
    try {
      const r = await fetch("/api/forms/registry/approvers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: approverEmail.trim(), password: approverPassword }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Could not create approver.");
      setApproverEmail("");
      setApproverPassword("");
      setApproverMsg({ ok: true, text: `Created approver account for ${d.approver?.email ?? approverEmail}.` });
      await loadApprovers();
    } catch (e: unknown) {
      setApproverMsg({ ok: false, text: e instanceof Error ? e.message : "Could not create approver." });
    }
  }

  async function deleteApprover(id: string) {
    if (!confirm("Delete this approver account?")) return;
    try {
      const r = await fetch(`/api/forms/registry/approvers/${id}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Delete failed.");
      await loadApprovers();
    } catch (e: unknown) {
      setApproverMsg({ ok: false, text: e instanceof Error ? e.message : "Delete failed." });
    }
  }

  async function resetApproverPassword() {
    setApproverMsg(null);
    if (!resetPasswordId || !resetPassword) {
      setApproverMsg({ ok: false, text: "Select an approver and enter a new password." });
      return;
    }
    try {
      const r = await fetch(`/api/forms/registry/approvers/${resetPasswordId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Password reset failed.");
      setResetPassword("");
      setApproverMsg({ ok: true, text: "Password reset successfully." });
    } catch (e: unknown) {
      setApproverMsg({ ok: false, text: e instanceof Error ? e.message : "Password reset failed." });
    }
  }

  const tabBtn = (id: AdminTab, label: string) => (
    <button
      key={id}
      type="button"
      className={`tab-btn ${tab === id ? "is-active" : ""}`}
      onClick={() => {
        setTab(id);
        if (id === "org") loadOrg();
        if (id === "webhooks") loadWebhooks();
        if (id === "schema") loadSchema();
        if (id === "platform") loadPlatform();
        if (id === "approvers") loadApprovers();
      }}
    >
      {label}
    </button>
  );

  return (
    <div className="forms-wrap">
      <div className="mb-5">
        <h2 className="forms-page-title">Form admin</h2>
        <p className="forms-page-subtitle">Manage forms, sync, schema, platform assets, and approver accounts.</p>
      </div>

      <div className="tabs">
        {tabBtn("forms", "Forms")}
        {tabBtn("org", "Org")}
        {tabBtn("webhooks", "Webhooks")}
        {tabBtn("schema", "Schema")}
        {tabBtn("platform", "Platform")}
        {tabBtn("approvers", "Approvers")}
      </div>

      {formsError ? <div className="note note--err">{formsError}</div> : null}

      {tab === "forms" ? (
        <>
          <section className="card">
            <h2>Your forms</h2>
            <p className="hint">Every form you create, clone, or add lives here. Active form path: {paths[activeId] ?? "—"}</p>
            <div className="toolbar">
              <input className="search" type="text" placeholder="Search by name or sheet ID…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <div className="table-wrap">
              {filtered.length === 0 ? (
                <p className="empty">No forms yet.</p>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Source</th>
                      <th>Sheet ID</th>
                      <th>Created</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((f) => {
                      const isActive = String(f.id) === activeId;
                      return (
                        <tr key={f.id} className={isActive ? "is-active" : ""}>
                          <td className="name">{f.name}</td>
                          <td>{SOURCE_LABEL[f.source]}</td>
                          <td className="id">{f.id}</td>
                          <td>{f.createdAt ? new Date(f.createdAt).toLocaleDateString() : ""}</td>
                          <td style={{ textAlign: "right" }}>
                            {isActive ? (
                              <span className="tag tag--on">Active</span>
                            ) : (
                              <button className="btn btn--ghost btn--sm" onClick={() => useForm(f.id)}>
                                Use
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="addSheet">Add an existing sheet</label>
              <p className="hint" style={{ marginBottom: 8 }}>
                {sheetsLive
                  ? `${addableSheets.length} sheet${addableSheets.length === 1 ? "" : "s"} available to add.`
                  : "Demo mode — showing sample sheets only."}
              </p>
              <div className="add-row">
                <select id="addSheet" value={addId} onChange={(e) => setAddId(e.target.value)}>
                  <option value="">Select a sheet…</option>
                  {addableSheets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (ID {s.id})
                    </option>
                  ))}
                </select>
                <button className="btn btn--ghost" onClick={addExisting} disabled={!addId}>
                  Add
                </button>
              </div>
              {sheetsError ? <div className="note note--err" style={{ marginTop: 8 }}>{sheetsError}</div> : null}
              {!sheetsError && sheets.length > 0 && addableSheets.length === 0 ? (
                <p className="hint" style={{ marginTop: 8 }}>All available sheets are already in your forms list.</p>
              ) : null}
            </div>
            {addMsg ? <div className={`note ${addMsg.ok ? "note--ok" : "note--err"}`}>{addMsg.text}</div> : null}
          </section>

          <section className="card">
            <h2>Create a form</h2>
            <div className="radios">
              <label className={mode === "template" ? "checked" : ""}>
                <input type="radio" name="mode" checked={mode === "template"} onChange={() => setMode("template")} /> From a template
              </label>
              <label className={mode === "scratch" ? "checked" : ""}>
                <input type="radio" name="mode" checked={mode === "scratch"} onChange={() => setMode("scratch")} /> From scratch
              </label>
            </div>
            {mode === "template" ? (
              <div className="field">
                <label htmlFor="template">Template sheet</label>
                <select id="template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                  <option value="">Select a sheet…</option>
                  {sheets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                {sheetsError ? <div className="note note--err" style={{ marginTop: 8 }}>{sheetsError}</div> : null}
              </div>
            ) : null}
            <div className="field">
              <label htmlFor="newName">New form name</label>
              <input id="newName" type="text" placeholder="e.g. Parking Permit Request" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="folderId">Destination folder ID (optional)</label>
              <input id="folderId" type="text" value={destinationFolderId} onChange={(e) => setDestinationFolderId(e.target.value)} placeholder="Smartsheet folder ID" />
            </div>
            <div className="field">
              <label htmlFor="shareOnCreate">Share with email on create (optional)</label>
              <input id="shareOnCreate" type="email" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} placeholder="approver@wsu.edu" />
            </div>
            <button className="btn" onClick={createForm} disabled={creating}>
              {creating ? "Creating…" : "Create form"}
            </button>
            {createMsg ? <div className={`note ${createMsg.ok ? "note--ok" : "note--err"}`}>{createMsg.text}</div> : null}
          </section>

          <section className="card">
            <h2>Automations</h2>
            <button className="btn btn--ghost" onClick={loadAutomations} disabled={autoLoading}>
              {autoLoading ? "Loading…" : "Load automations"}
            </button>
            {rules?.map((rule, i) => (
              <div className="rule" key={i}>
                <div className="rule__top">
                  <span className="rule__name">{rule.name || "(unnamed rule)"}</span>
                  <span className={`tag ${rule.enabled !== false ? "tag--on" : ""}`}>{rule.enabled !== false ? "Enabled" : "Disabled"}</span>
                </div>
              </div>
            ))}
            {autoNotice ? <div className="note" style={{ marginTop: 12 }}>{autoNotice}</div> : null}
          </section>
        </>
      ) : null}

      {tab === "org" ? (
        <section className="card">
          <h2>Organization & sharing</h2>
          <p className="hint">Workspaces and folder placement for cloned forms.</p>
          <h3>Workspaces</h3>
          <ul>
            {workspaces.map((w) => (
              <li key={w.id}>
                {w.name} (ID {w.id})
              </li>
            ))}
          </ul>
          {folderChildren.length ? (
            <>
              <h3>Folder contents</h3>
              <ul>
                {folderChildren.map((c) => (
                  <li key={c.id}>
                    {c.name} — {c.type} (ID {c.id})
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <h3>Share active sheet</h3>
          <div className="add-row">
            <input type="email" placeholder="user@wsu.edu" value={shareSheetEmail} onChange={(e) => setShareSheetEmail(e.target.value)} />
            <button className="btn btn--ghost" onClick={shareActiveSheet}>
              Share
            </button>
          </div>
          {shareMsg ? <div className="note">{shareMsg}</div> : null}
        </section>
      ) : null}

      {tab === "webhooks" ? (
        <section className="card">
          <h2>Live sync (webhooks)</h2>
          <p className="hint">Register a webhook so the tracker refreshes when Smartsheet changes. Set WEBHOOK_CALLBACK_URL in .env for production.</p>
          <button className="btn btn--ghost" onClick={registerWebhook}>
            Register webhook for active sheet
          </button>
          {webhookInfo ? (
            <div style={{ marginTop: 12 }}>
              <p>Registered webhooks: {webhookInfo.webhooks?.length ?? 0}</p>
              <p className="muted">Last webhook: {webhookInfo.state?.lastWebhookAt ?? "none"}</p>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === "schema" ? (
        <section className="card">
          <h2>Column schema</h2>
          <p className="hint">Add columns to the active sheet. Changes affect the live form immediately.</p>
          <button className="btn btn--ghost" onClick={loadSchema}>
            Refresh columns
          </button>
          <ul>
            {columns.map((c) => (
              <li key={c.id}>
                {c.title} ({c.type}) — ID {c.id}
              </li>
            ))}
          </ul>
          <div className="add-row">
            <input type="text" placeholder="New column title" value={newColTitle} onChange={(e) => setNewColTitle(e.target.value)} />
            <button className="btn btn--ghost" onClick={addColumn}>
              Add column
            </button>
          </div>
        </section>
      ) : null}

      {tab === "platform" ? (
        <section className="card">
          <h2>Reports, dashboards & native forms</h2>
          <button className="btn btn--ghost" onClick={loadPlatform}>
            Load platform assets
          </button>
          <h3>Reports</h3>
          <ul>
            {reports.map((r) => (
              <li key={r.id}>
                <a href={r.permalink || "#"} target="_blank" rel="noreferrer">
                  {r.name}
                </a>
              </li>
            ))}
          </ul>
          <h3>Dashboards</h3>
          <ul>
            {dashboards.map((d) => (
              <li key={d.id}>
                <a href={d.permalink || "#"} target="_blank" rel="noreferrer">
                  {d.name}
                </a>
              </li>
            ))}
          </ul>
          <h3>Native Smartsheet forms</h3>
          <ul>
            {nativeForms.map((f) => (
              <li key={f.id}>
                {f.name}{" "}
                {f.url ? (
                  <a href={f.url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
          <h3>Row tools</h3>
          <div className="add-row">
            <input type="text" placeholder="Row ID" value={rowToolRowId} onChange={(e) => setRowToolRowId(e.target.value)} />
            <input type="text" placeholder="Target sheet ID" value={rowToolSheetId} onChange={(e) => setRowToolSheetId(e.target.value)} />
            <button className="btn btn--ghost" onClick={copyRowTool}>
              Copy row
            </button>
          </div>
          {rowToolMsg ? <div className="note">{rowToolMsg}</div> : null}
        </section>
      ) : null}

      {tab === "approvers" ? (
        <section className="card">
          <h2>Approver accounts</h2>
          <p className="hint">
            Create email/password accounts for approvers who need tracker access without admin credentials. Password requirement:{" "}
            {ADMIN_PASSWORD_POLICY_MESSAGE.replace("Admin password must be ", "")}
          </p>
          <button className="btn btn--ghost" onClick={loadApprovers}>
            Refresh list
          </button>
          {approvers.length === 0 ? (
            <p className="empty">No approver accounts yet.</p>
          ) : (
            <table className="table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {approvers.map((a) => (
                  <tr key={a.id}>
                    <td className="name">{a.email}</td>
                    <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td style={{ textAlign: "right" }}>
                      <button className="btn btn--ghost btn--sm btn--danger" onClick={() => deleteApprover(a.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <h3 style={{ marginTop: 20 }}>Create approver</h3>
          <div className="field">
            <label htmlFor="approverEmail">Email</label>
            <input id="approverEmail" type="email" value={approverEmail} onChange={(e) => setApproverEmail(e.target.value)} placeholder="approver@wsu.edu" />
          </div>
          <div className="field">
            <label htmlFor="approverPassword">Password</label>
            <input id="approverPassword" type="password" value={approverPassword} onChange={(e) => setApproverPassword(e.target.value)} />
          </div>
          <button className="btn" onClick={createApprover}>
            Create approver
          </button>
          <h3 style={{ marginTop: 20 }}>Reset password</h3>
          <div className="add-row">
            <select value={resetPasswordId} onChange={(e) => setResetPasswordId(e.target.value)}>
              <option value="">Select approver…</option>
              {approvers.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email}
                </option>
              ))}
            </select>
            <input type="password" placeholder="New password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} />
            <button className="btn btn--ghost" onClick={resetApproverPassword}>
              Reset
            </button>
          </div>
          {approverMsg ? <div className={`note ${approverMsg.ok ? "note--ok" : "note--err"}`}>{approverMsg.text}</div> : null}
        </section>
      ) : null}
    </div>
  );
}
