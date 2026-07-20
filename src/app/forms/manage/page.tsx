"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AddSheetCard } from "@/components/forms/admin/AddSheetCard";
import { Alert, primaryBtnClass } from "@/components/forms/admin/AdminCard";
import type { AdminTab } from "@/components/forms/admin/AdminSectionNav";
import { ApproversCard } from "@/components/forms/admin/ApproversCard";
import { AutomationsCard } from "@/components/forms/admin/AutomationsCard";
import { CreateFormModal } from "@/components/forms/admin/CreateFormModal";
import { FormsTable } from "@/components/forms/admin/FormsTable";
import { MetricsStrip } from "@/components/forms/admin/MetricsStrip";
import { OrgSharingCard } from "@/components/forms/admin/OrgSharingCard";
import { WebhooksCard } from "@/components/forms/admin/WebhooksCard";
import { FormsWorkspaceChrome } from "@/components/forms/layout/FormsWorkspaceChrome";
import { IconPlus } from "@/components/forms/icons";

interface FormEntry {
  id: string;
  name: string;
  createdAt: string;
  source: "template" | "scratch" | "imported" | "sample";
  slug?: string;
  public?: boolean;
  publishedAt?: string;
  sourceConfigId?: string;
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

async function parseJson(r: Response): Promise<Record<string, unknown>> {
  const text = await r.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      r.ok
        ? "Invalid response from server."
        : `Request failed (${r.status}). Sign in again if you were redirected.`,
    );
  }
}

const MANAGE_TABS: AdminTab[] = ["forms", "org", "webhooks", "approvers"];

function tabFromSearchParam(value: string | null): AdminTab {
  if (value && MANAGE_TABS.includes(value as AdminTab)) return value as AdminTab;
  return "forms";
}

export default function ManagePage() {
  return (
    <Suspense
      fallback={
        <FormsWorkspaceChrome>
          <p className="text-sm text-[color:var(--wsu-muted)]">Loading…</p>
        </FormsWorkspaceChrome>
      }
    >
      <ManagePageContent />
    </Suspense>
  );
}

function ManagePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [tab, setTab] = useState<AdminTab>(() => tabFromSearchParam(searchParams.get("tab")));
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
  const [approvers, setApprovers] = useState<ApproverSummary[]>([]);
  const [approverEmail, setApproverEmail] = useState("");
  const [approverPassword, setApproverPassword] = useState("");
  const [approverMsg, setApproverMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [resetPasswordId, setResetPasswordId] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);
  const [formsLoading, setFormsLoading] = useState(true);
  const [sheetsLoading, setSheetsLoading] = useState(true);

  async function publishForm(id: string) {
    setPublishBusyId(id);
    setFormsError("");
    try {
      const r = await fetch(`/api/forms/registry/${encodeURIComponent(id)}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Publish failed.");
      await loadForms();
      if (d.publicUrl) {
        const absolute = `${window.location.origin}${d.publicUrl}`;
        void navigator.clipboard.writeText(absolute).catch(() => undefined);
      }
    } catch (e: unknown) {
      setFormsError(e instanceof Error ? e.message : "Publish failed.");
    } finally {
      setPublishBusyId(null);
    }
  }

  async function unpublishForm(id: string) {
    setPublishBusyId(id);
    setFormsError("");
    try {
      const r = await fetch(`/api/forms/registry/${encodeURIComponent(id)}/unpublish`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || d.message || "Unpublish failed.");
      await loadForms();
    } catch (e: unknown) {
      setFormsError(e instanceof Error ? e.message : "Unpublish failed.");
    } finally {
      setPublishBusyId(null);
    }
  }

  async function loadForms() {
    setFormsLoading(true);
    try {
      const r = await fetch("/api/forms/registry");
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Could not load forms."));
      setForms((d.forms as FormEntry[]) ?? []);
      setActiveId(String(d.activeSheetId || ""));
      setFormsError("");
    } catch (e: unknown) {
      setFormsError(e instanceof Error ? e.message : "Could not load forms.");
    } finally {
      setFormsLoading(false);
    }
  }

  async function loadSheets() {
    setSheetsLoading(true);
    try {
      const r = await fetch("/api/forms/platform/sheets");
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Could not load sheets from Smartsheet."));
      setSheets((d.sheets as SheetOption[]) ?? []);
      setSheetsLive(!d.demo);
      setSheetsError("");
      if (d.defaultTemplateId) setTemplateId(String(d.defaultTemplateId));
    } catch (e: unknown) {
      setSheets([]);
      setSheetsError(e instanceof Error ? e.message : "Could not load sheets.");
    } finally {
      setSheetsLoading(false);
    }
  }

  async function loadApprovers() {
    setApproverMsg(null);
    try {
      const r = await fetch("/api/forms/registry/approvers");
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Could not load approvers."));
      setApprovers((d.approvers as ApproverSummary[]) ?? []);
    } catch (e: unknown) {
      setApproverMsg({ ok: false, text: e instanceof Error ? e.message : "Could not load approvers." });
    }
  }

  useEffect(() => {
    void loadForms();
    // Smartsheet catalog is slow — load after the forms list so the main table can paint first.
    const timer = window.setTimeout(() => {
      void loadSheets();
    }, 0);
    return () => window.clearTimeout(timer);
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
    return forms.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        String(f.id).includes(q) ||
        (f.slug ?? "").toLowerCase().includes(q),
    );
  }, [forms, query]);

  const registeredIds = useMemo(() => new Set(forms.map((f) => String(f.id))), [forms]);
  const addableSheets = useMemo(
    () => sheets.filter((s) => !registeredIds.has(String(s.id))),
    [sheets, registeredIds],
  );

  function handleSectionSelect(id: AdminTab) {
    setTab(id);
    const href = id === "forms" ? "/forms/manage" : `/forms/manage?tab=${id}`;
    router.replace(href);
  }

  useEffect(() => {
    setTab(tabFromSearchParam(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    if (tab === "org") loadOrg();
    if (tab === "webhooks") loadWebhooks();
    if (tab === "approvers") loadApprovers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load helpers are stable closures over setters
  }, [tab]);

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
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Could not switch form."));
      await loadForms();
    } catch (e: unknown) {
      setFormsError(e instanceof Error ? e.message : "Could not switch form.");
    }
  }

  async function editForm(id: string) {
    setFormsError("");
    try {
      if (String(id) !== activeId) {
        const r = await fetch("/api/forms/registry/select", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const d = await parseJson(r);
        if (!r.ok) throw new Error(String(d.error || d.message || "Could not open form in builder."));
      }
      router.push("/forms/builder");
    } catch (e: unknown) {
      setFormsError(e instanceof Error ? e.message : "Could not open form in builder.");
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
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Could not add that sheet."));
      const sheet = d.sheet as { name?: string } | undefined;
      setAddId("");
      setAddMsg({ ok: true, text: `Added "${sheet?.name ?? id}" and set it active.` });
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
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Create failed."));
      setNewName("");
      setShareEmail("");
      const sheet = d.sheet as { name?: string } | undefined;
      setCreateMsg({ ok: true, text: `Created "${sheet?.name ?? "form"}" and set it active.${d.note ? " " + d.note : ""}` });
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
    <FormsWorkspaceChrome
      activeTab={tab}
      onSelectTab={handleSectionSelect}
      actions={
        <button type="button" onClick={openCreateModal} className={`inline-flex items-center gap-1.5 ${primaryBtnClass}`}>
          <IconPlus className="h-4 w-4" />
          Create form
        </button>
      }
    >
      {formsError ? <Alert text={formsError} /> : null}

      {tab === "forms" ? (
        <div className="space-y-4">
          <MetricsStrip
            activeForms={formsLoading ? null : forms.length}
            sheetsAvailable={sheetsLoading ? null : sheets.length}
          />

          <FormsTable
            forms={filtered}
            activeId={activeId}
            activePath={paths[activeId] ?? ""}
            query={query}
            onQueryChange={setQuery}
            onUseForm={useForm}
            onEdit={editForm}
            onPublish={publishForm}
            onUnpublish={unpublishForm}
            busyId={publishBusyId}
            loading={formsLoading}
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
              sheetsLoading={sheetsLoading}
              addMsg={addMsg}
              allSheetsRegistered={!sheetsLoading && !sheetsError && sheets.length > 0 && addableSheets.length === 0}
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
        <OrgSharingCard
          workspaces={workspaces}
          folderChildren={folderChildren}
          shareSheetEmail={shareSheetEmail}
          onShareSheetEmailChange={setShareSheetEmail}
          onShare={shareActiveSheet}
          shareMsg={shareMsg}
        />
      ) : null}

      {tab === "webhooks" ? (
        <WebhooksCard webhookInfo={webhookInfo} onRegister={registerWebhook} />
      ) : null}

      {tab === "approvers" ? (
        <ApproversCard
          approvers={approvers}
          approverEmail={approverEmail}
          onApproverEmailChange={setApproverEmail}
          approverPassword={approverPassword}
          onApproverPasswordChange={setApproverPassword}
          approverMsg={approverMsg}
          resetPasswordId={resetPasswordId}
          onResetPasswordIdChange={setResetPasswordId}
          resetPassword={resetPassword}
          onResetPasswordChange={setResetPassword}
          onLoadApprovers={loadApprovers}
          onCreateApprover={createApprover}
          onDeleteApprover={deleteApprover}
          onResetPassword={resetApproverPassword}
        />
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
    </FormsWorkspaceChrome>
  );
}
