"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ADMIN_PASSWORD_POLICY_MESSAGE } from "@/lib/admin-auth";
import { AddSheetCard } from "@/components/forms/admin/AddSheetCard";
import { AdminSectionNav, type AdminTab } from "@/components/forms/admin/AdminSectionNav";
import { AutomationsCard } from "@/components/forms/admin/AutomationsCard";
import { CreateFormModal } from "@/components/forms/admin/CreateFormModal";
import { FormsTable } from "@/components/forms/admin/FormsTable";
import { MetricsStrip } from "@/components/forms/admin/MetricsStrip";
import { IconPlus } from "@/components/forms/icons";
import { PageHeader } from "@/components/layout/PageHeader";

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

const inputClass =
  "w-full rounded-lg border border-[color:var(--wsu-border)] px-3 py-2 text-sm text-[color:var(--wsu-ink)] placeholder:text-[color:var(--wsu-muted)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson";

const secondaryBtnClass =
  "rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-50";

const primaryBtnClass =
  "rounded-lg bg-wsu-crimson px-4 py-2 text-sm font-medium text-white hover:bg-wsu-crimson-dark disabled:opacity-60";

function Alert({ ok, text }: { ok?: boolean; text: string }) {
  return (
    <p className={`rounded-lg px-3 py-2 text-xs ${ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
      {text}
    </p>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
      <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">{title}</h2>
      {description ? <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export default function ManagePage() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
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

  useEffect(() => {
    loadForms();
    loadSheets();
    loadApprovers();
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

  function handleSectionSelect(id: AdminTab) {
    setTab(id);
    if (id === "org") loadOrg();
    if (id === "webhooks") loadWebhooks();
    if (id === "schema") loadSchema();
    if (id === "platform") loadPlatform();
    if (id === "approvers") loadApprovers();
  }

  function openCreateModal() {
    setCreateMsg(null);
    setCreateModalOpen(true);
  }

  function closeCreateModal() {
    if (creating) return;
    setCreateModalOpen(false);
    setCreateMsg(null);
  }

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
      setCreateModalOpen(false);
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
      body: JSON.stringify({ columns: [{ title: newColTitle.trim(), type: "TEXT_NUMBER", index: columns.length }], index: columns.length }),
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Forms workspace"
        title="Form administration"
        description="Manage forms, sync, schema, platform assets, and approver accounts."
        actions={
          <button type="button" onClick={openCreateModal} className={`inline-flex items-center gap-1.5 ${primaryBtnClass}`}>
            <IconPlus className="h-4 w-4" />
            Create form
          </button>
        }
      />

      <AdminSectionNav active={tab} onSelect={handleSectionSelect} />

      {formsError ? <Alert text={formsError} /> : null}

      {tab === "forms" ? (
        <div className="space-y-4">
          <MetricsStrip
            activeForms={forms.length}
            sheetsAvailable={sheets.length}
            approvers={approvers.length}
          />

          <FormsTable
            forms={filtered}
            activeId={activeId}
            activePath={paths[activeId] ?? ""}
            query={query}
            onQueryChange={setQuery}
            onUseForm={useForm}
          />

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AddSheetCard
              sheetsLive={sheetsLive}
              addableCount={addableSheets.length}
              sheets={addableSheets}
              addId={addId}
              onAddIdChange={setAddId}
              onAdd={addExisting}
              sheetsError={sheetsError}
              addMsg={addMsg}
              allSheetsRegistered={!sheetsError && sheets.length > 0 && addableSheets.length === 0}
            />
            <AutomationsCard
              rules={rules}
              autoNotice={autoNotice}
              autoLoading={autoLoading}
              onLoad={loadAutomations}
            />
          </div>
        </div>
      ) : null}

      {tab === "org" ? (
        <Card title="Organization & sharing" description="Workspaces and folder placement for cloned forms.">
          <div>
            <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Workspaces</h3>
            <ul className="mt-2 space-y-1 text-sm text-[color:var(--wsu-ink)]">
              {workspaces.map((w) => (
                <li key={w.id}>
                  {w.name} (ID {w.id})
                </li>
              ))}
            </ul>
          </div>
          {folderChildren.length ? (
            <div>
              <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Folder contents</h3>
              <ul className="mt-2 space-y-1 text-sm text-[color:var(--wsu-ink)]">
                {folderChildren.map((c) => (
                  <li key={c.id}>
                    {c.name} — {c.type} (ID {c.id})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Share active sheet</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="email"
                placeholder="user@wsu.edu"
                value={shareSheetEmail}
                onChange={(e) => setShareSheetEmail(e.target.value)}
                className={`min-w-0 flex-1 ${inputClass}`}
              />
              <button type="button" onClick={shareActiveSheet} className={secondaryBtnClass}>
                Share
              </button>
            </div>
            {shareMsg ? <p className="mt-2 text-xs text-[color:var(--wsu-muted)]">{shareMsg}</p> : null}
          </div>
        </Card>
      ) : null}

      {tab === "webhooks" ? (
        <Card
          title="Live sync (webhooks)"
          description="Register a webhook so the tracker refreshes when Smartsheet changes. Set WEBHOOK_CALLBACK_URL in .env for production."
        >
          <button type="button" onClick={registerWebhook} className={secondaryBtnClass}>
            Register webhook for active sheet
          </button>
          {webhookInfo ? (
            <div className="text-sm text-[color:var(--wsu-muted)]">
              <p>Registered webhooks: {webhookInfo.webhooks?.length ?? 0}</p>
              <p>Last webhook: {webhookInfo.state?.lastWebhookAt ?? "none"}</p>
            </div>
          ) : null}
        </Card>
      ) : null}

      {tab === "schema" ? (
        <Card title="Column schema" description="Add columns to the active sheet. Changes affect the live form immediately.">
          <Link href="/forms/builder" className="inline-flex text-sm font-medium text-wsu-crimson hover:underline">
            Open form builder →
          </Link>
          <button type="button" onClick={loadSchema} className={secondaryBtnClass}>
            Refresh columns
          </button>
          <ul className="space-y-1 text-sm text-[color:var(--wsu-ink)]">
            {columns.map((c) => (
              <li key={c.id}>
                {c.title} ({c.type}) — ID {c.id}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              placeholder="New column title"
              value={newColTitle}
              onChange={(e) => setNewColTitle(e.target.value)}
              className={`min-w-0 flex-1 ${inputClass}`}
            />
            <button type="button" onClick={addColumn} className={secondaryBtnClass}>
              Add column
            </button>
          </div>
        </Card>
      ) : null}

      {tab === "platform" ? (
        <Card title="Reports, dashboards & native forms">
          <button type="button" onClick={loadPlatform} className={secondaryBtnClass}>
            Load platform assets
          </button>
          <div>
            <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Reports</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {reports.map((r) => (
                <li key={r.id}>
                  <a href={r.permalink || "#"} target="_blank" rel="noreferrer" className="text-wsu-crimson hover:underline">
                    {r.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Dashboards</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {dashboards.map((d) => (
                <li key={d.id}>
                  <a href={d.permalink || "#"} target="_blank" rel="noreferrer" className="text-wsu-crimson hover:underline">
                    {d.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Native Smartsheet forms</h3>
            <ul className="mt-2 space-y-1 text-sm text-[color:var(--wsu-ink)]">
              {nativeForms.map((f) => (
                <li key={f.id}>
                  {f.name}{" "}
                  {f.url ? (
                    <a href={f.url} target="_blank" rel="noreferrer" className="text-wsu-crimson hover:underline">
                      Open
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Row tools</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="Row ID"
                value={rowToolRowId}
                onChange={(e) => setRowToolRowId(e.target.value)}
                className={`min-w-[8rem] flex-1 ${inputClass}`}
              />
              <input
                type="text"
                placeholder="Target sheet ID"
                value={rowToolSheetId}
                onChange={(e) => setRowToolSheetId(e.target.value)}
                className={`min-w-[8rem] flex-1 ${inputClass}`}
              />
              <button type="button" onClick={copyRowTool} className={secondaryBtnClass}>
                Copy row
              </button>
            </div>
            {rowToolMsg ? <p className="text-xs text-[color:var(--wsu-muted)]">{rowToolMsg}</p> : null}
          </div>
        </Card>
      ) : null}

      {tab === "approvers" ? (
        <Card
          title="Approver accounts"
          description={`Create email/password accounts for approvers who need tracker access without admin credentials. Password requirement: ${ADMIN_PASSWORD_POLICY_MESSAGE.replace("Admin password must be ", "")}`}
        >
          <button type="button" onClick={loadApprovers} className={secondaryBtnClass}>
            Refresh list
          </button>
          {approvers.length === 0 ? (
            <p className="text-sm text-[color:var(--wsu-muted)]">No approver accounts yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[color:var(--wsu-border)]">
              <table className="w-full min-w-[400px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--wsu-border)] text-xs text-[color:var(--wsu-muted)]">
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Created</th>
                    <th className="px-3 py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {approvers.map((a) => (
                    <tr key={a.id} className="border-b border-[color:var(--wsu-border)] last:border-0 hover:bg-[color:var(--wsu-stone)]/60">
                      <td className="px-3 py-2 font-medium text-[color:var(--wsu-ink)]">{a.email}</td>
                      <td className="px-3 py-2 text-[color:var(--wsu-muted)]">{new Date(a.createdAt).toLocaleDateString()}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => deleteApprover(a.id)}
                          className="text-xs font-medium text-red-700 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div>
            <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Create approver</h3>
            <div className="mt-2 space-y-3">
              <div>
                <label htmlFor="approverEmail" className="mb-1 block text-xs text-[color:var(--wsu-muted)]">
                  Email
                </label>
                <input
                  id="approverEmail"
                  type="email"
                  value={approverEmail}
                  onChange={(e) => setApproverEmail(e.target.value)}
                  placeholder="approver@wsu.edu"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="approverPassword" className="mb-1 block text-xs text-[color:var(--wsu-muted)]">
                  Password
                </label>
                <input
                  id="approverPassword"
                  type="password"
                  value={approverPassword}
                  onChange={(e) => setApproverPassword(e.target.value)}
                  className={inputClass}
                />
              </div>
              <button type="button" onClick={createApprover} className={primaryBtnClass}>
                Create approver
              </button>
            </div>
          </div>
          <div>
            <h3 className="text-xs font-medium text-[color:var(--wsu-muted)]">Reset password</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <select
                value={resetPasswordId}
                onChange={(e) => setResetPasswordId(e.target.value)}
                className={`min-w-[10rem] flex-1 ${inputClass}`}
              >
                <option value="">Select approver…</option>
                {approvers.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.email}
                  </option>
                ))}
              </select>
              <input
                type="password"
                placeholder="New password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className={`min-w-[10rem] flex-1 ${inputClass}`}
              />
              <button type="button" onClick={resetApproverPassword} className={secondaryBtnClass}>
                Reset
              </button>
            </div>
          </div>
          {approverMsg ? <Alert ok={approverMsg.ok} text={approverMsg.text} /> : null}
        </Card>
      ) : null}

      <CreateFormModal
        open={createModalOpen}
        onClose={closeCreateModal}
        mode={mode}
        onModeChange={setMode}
        templateId={templateId}
        onTemplateIdChange={setTemplateId}
        sheets={sheets}
        sheetsError={sheetsError}
        newName={newName}
        onNewNameChange={setNewName}
        destinationFolderId={destinationFolderId}
        onDestinationFolderIdChange={setDestinationFolderId}
        shareEmail={shareEmail}
        onShareEmailChange={setShareEmail}
        creating={creating}
        onCreate={createForm}
        createMsg={createMsg}
      />
    </div>
  );
}
