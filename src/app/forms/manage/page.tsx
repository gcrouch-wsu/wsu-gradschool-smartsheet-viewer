"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AddSheetCard } from "@/components/forms/admin/AddSheetCard";
import { Alert, primaryBtnClass } from "@/components/forms/admin/AdminCard";
import type { AdminTab } from "@/components/forms/admin/AdminSectionNav";
import { AutomationsCard } from "@/components/forms/admin/AutomationsCard";
import { CreateFormModal } from "@/components/forms/admin/CreateFormModal";
import { DuplicateFormModal } from "@/components/forms/admin/DuplicateFormModal";
import { FormsTable } from "@/components/forms/admin/FormsTable";
import { MetricsStrip } from "@/components/forms/admin/MetricsStrip";
import { WebhooksCard, type WebhookInfo } from "@/components/forms/admin/WebhooksCard";
import { FormsWorkspaceChrome } from "@/components/forms/layout/FormsWorkspaceChrome";
import { IconPlus } from "@/components/forms/icons";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

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

const MANAGE_TABS: AdminTab[] = ["forms", "webhooks"];

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
  const tab = tabFromSearchParam(searchParams.get("tab"));
  const [createModalOpen, setCreateModalOpen] = useState(false);
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
  const [creating, setCreating] = useState(false);
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [autoNotice, setAutoNotice] = useState("");
  const [autoLoading, setAutoLoading] = useState(false);
  const [paths, setPaths] = useState<Record<string, string>>({});
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [webhookRegistering, setWebhookRegistering] = useState(false);
  const [webhookRefreshing, setWebhookRefreshing] = useState(false);
  const [webhookTogglingId, setWebhookTogglingId] = useState<number | null>(null);
  const [webhookDeletingId, setWebhookDeletingId] = useState<number | null>(null);
  const [deleteWebhookId, setDeleteWebhookId] = useState<number | null>(null);
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);
  const [formsLoading, setFormsLoading] = useState(true);
  const [sheetsLoading, setSheetsLoading] = useState(true);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [duplicateSourceId, setDuplicateSourceId] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateError, setDuplicateError] = useState("");
  const [duplicating, setDuplicating] = useState(false);

  const duplicateSource = useMemo(
    () => forms.find((f) => String(f.id) === String(duplicateSourceId ?? "")) ?? null,
    [forms, duplicateSourceId],
  );

  function defaultDuplicateName(sourceName: string): string {
    const base = sourceName.trim() || "Form";
    if (/\(copy\)\s*$/i.test(base)) return `${base} ${Date.now().toString().slice(-4)}`;
    return `${base} (copy)`;
  }

  function openDuplicateModal(id: string) {
    const source = forms.find((f) => String(f.id) === String(id));
    setDuplicateSourceId(id);
    setDuplicateName(defaultDuplicateName(source?.name ?? "Form"));
    setDuplicateError("");
    setDuplicateModalOpen(true);
  }

  function closeDuplicateModal() {
    if (duplicating) return;
    setDuplicateModalOpen(false);
    setDuplicateSourceId(null);
    setDuplicateName("");
    setDuplicateError("");
  }

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

  async function confirmDuplicateForm() {
    const id = duplicateSourceId;
    if (!id) return;
    const newName = duplicateName.trim();
    if (!newName) {
      setDuplicateError("Enter a name for the duplicated sheet.");
      return;
    }

    setDuplicating(true);
    setPublishBusyId(id);
    setDuplicateError("");
    setFormsError("");
    try {
      const r = await fetch(`/api/forms/registry/${encodeURIComponent(id)}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName }),
      });
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Duplicate failed."));
      setDuplicateModalOpen(false);
      setDuplicateSourceId(null);
      setDuplicateName("");
      await loadForms();
      await loadSheets();
      router.push("/forms/builder");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Duplicate failed.";
      setDuplicateError(message);
      setFormsError(message);
    } finally {
      setDuplicating(false);
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
    } catch (e: unknown) {
      setSheets([]);
      setSheetsError(e instanceof Error ? e.message : "Could not load sheets.");
    } finally {
      setSheetsLoading(false);
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
    const href = id === "forms" ? "/forms/manage" : `/forms/manage?tab=${id}`;
    router.replace(href);
  }

  useEffect(() => {
    if (tab === "webhooks") void loadWebhooks();
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

  function viewSheet(id: string) {
    router.push(`/forms/sheet?sheetId=${encodeURIComponent(id)}`);
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
        }),
      });
      const d = await parseJson(r);
      if (!r.ok) throw new Error(String(d.error || d.message || "Create failed."));
      setNewName("");
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

  async function loadWebhooks(opts?: { silent?: boolean }) {
    if (!opts?.silent) setWebhookRefreshing(true);
    try {
      const r = await fetch("/api/forms/webhooks");
      const d = await r.json();
      if (r.ok) setWebhookInfo(d);
      else if (!opts?.silent) setFormsError(d.error || d.message || "Could not load webhooks.");
    } finally {
      if (!opts?.silent) setWebhookRefreshing(false);
    }
  }

  async function registerWebhook() {
    setWebhookRegistering(true);
    setFormsError("");
    try {
      const r = await fetch("/api/forms/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const d = await r.json();
      if (!r.ok) setFormsError(d.error || d.message || "Webhook registration failed.");
      else await loadWebhooks({ silent: true });
    } finally {
      setWebhookRegistering(false);
    }
  }

  async function setWebhookEnabled(webhookId: number, enabled: boolean) {
    setWebhookTogglingId(webhookId);
    setFormsError("");
    try {
      const r = await fetch(`/api/forms/webhooks/${encodeURIComponent(String(webhookId))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      const d = await r.json();
      if (!r.ok) {
        setFormsError(d.error || d.message || `Could not ${enabled ? "enable" : "disable"} webhook.`);
        return;
      }
      await loadWebhooks({ silent: true });
    } finally {
      setWebhookTogglingId(null);
    }
  }

  function openDeleteWebhookModal(webhookId: number) {
    setDeleteWebhookId(webhookId);
    setFormsError("");
  }

  function closeDeleteWebhookModal() {
    if (webhookDeletingId != null) return;
    setDeleteWebhookId(null);
  }

  async function confirmDeleteWebhook() {
    const webhookId = deleteWebhookId;
    if (webhookId == null) return;

    setWebhookDeletingId(webhookId);
    setFormsError("");
    try {
      const r = await fetch(`/api/forms/webhooks/${encodeURIComponent(String(webhookId))}`, {
        method: "DELETE",
      });
      const d = await r.json();
      if (!r.ok) {
        setFormsError(d.error || d.message || "Could not delete webhook.");
        return;
      }
      setDeleteWebhookId(null);
      await loadWebhooks({ silent: true });
    } finally {
      setWebhookDeletingId(null);
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
            onViewSheet={viewSheet}
            onPublish={publishForm}
            onUnpublish={unpublishForm}
            onDuplicate={openDuplicateModal}
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

      {tab === "webhooks" ? (
        <WebhooksCard
          webhookInfo={webhookInfo}
          onRegister={registerWebhook}
          onRefresh={() => void loadWebhooks()}
          onSetEnabled={(id, enabled) => void setWebhookEnabled(id, enabled)}
          onDelete={openDeleteWebhookModal}
          registering={webhookRegistering}
          refreshing={webhookRefreshing}
          togglingId={webhookTogglingId}
          deletingId={webhookDeletingId}
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
        creating={creating}
        onCreate={createForm}
        createMsg={createMsg}
      />

      <DuplicateFormModal
        open={duplicateModalOpen}
        onClose={closeDuplicateModal}
        sourceName={duplicateSource?.name ?? ""}
        newName={duplicateName}
        onNewNameChange={setDuplicateName}
        duplicating={duplicating}
        onConfirm={() => void confirmDuplicateForm()}
        error={duplicateError}
      />

      <ConfirmModal
        open={deleteWebhookId != null}
        onClose={closeDeleteWebhookModal}
        onConfirm={() => void confirmDeleteWebhook()}
        title="Delete webhook"
        message="Are you sure you want to delete this webhook? Smartsheet will stop notifying this app for that sheet until you register again. This cannot be undone."
        confirmLabel="Delete webhook"
        danger
        busy={webhookDeletingId != null}
        busyLabel="Deleting…"
      />
    </FormsWorkspaceChrome>
  );
}
