"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { ContributorProvider } from "@/components/views/contributor/ContributorContext";
import { DisplayTimezoneProvider } from "@/components/views/shared/DisplayTimezoneContext";
import { EditRowDrawer } from "@/components/views/contributor/EditRowDrawer";
import { PublicViewRenderer } from "@/components/views/layouts/ViewRenderer";
import { ViewValueLinkProvider } from "@/components/views/shared/ViewValueLinkContext";
import { describeResolvedField, getIndexText } from "@/components/views/layouts/layout-utils";
import {
  groupResolvedRows,
  indexLetterFromLabel,
  isCampusGroupingActive,
  narrowProgramGroupsToFilteredRows,
  normalizeCampusDisplay,
} from "@/lib/campus-grouping";
import type { LayoutType, ResolvedView, ResolvedViewRow } from "@/lib/config/types";
import type { ContributorEditingClientConfig } from "@/lib/contributor-utils";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function canOpenContributorEditor(
  embed: boolean,
  contributorEmail?: string | null,
  editingConfig?: ContributorEditingClientConfig | null,
  adminUnrestrictedEditing?: boolean,
) {
  return !embed && Boolean(editingConfig && (contributorEmail || adminUnrestrictedEditing));
}

function getSearchableText(view: ResolvedView, row: ResolvedViewRow): string {
  const parts: string[] = [];
  for (const field of row.fields) {
    const text = describeResolvedField(field);
    if (text) parts.push(text);
    if (field.links.length > 0) {
      parts.push(...field.links.map((l) => l.label));
    }
    if (field.listValue.length > 0) {
      parts.push(...field.listValue);
    }
  }
  return parts.join(" ").toLowerCase();
}

function getIndexLetter(view: ResolvedView, row: ResolvedViewRow): string {
  const text = getIndexText(view, row);
  return indexLetterFromLabel(text);
}

export function ViewWithSearchAndIndex({
  view,
  layout,
  embed,
  slug = "",
  viewId = "",
  contributorEmail = null,
  editingConfig = null,
  editableRowIds = [],
  adminUnrestrictedEditing = false,
  adminEditingLabel = null,
  contributorRowsFiltered = false,
  printHref,
  contributorInstructionsHref,
}: {
  view: ResolvedView;
  layout: LayoutType;
  embed: boolean;
  slug?: string;
  viewId?: string;
  contributorEmail?: string | null;
  editingConfig?: ContributorEditingClientConfig | null;
  editableRowIds?: number[];
  adminUnrestrictedEditing?: boolean;
  adminEditingLabel?: string | null;
  contributorRowsFiltered?: boolean;
  printHref?: string;
  contributorInstructionsHref?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const editReturnFocusRef = useRef<HTMLElement | null>(null);
  /** `null` = All campuses */
  const [selectedCampus, setSelectedCampus] = useState<string | null>(null);

  const groupingOn = isCampusGroupingActive(view.presentation);
  const showCampusStrip = Boolean(groupingOn && view.presentation?.showCampusFilter && view.presentation?.campusFieldKey);

  // Leave guard for unsaved changes
  useEffect(() => {
    if (editingRowId == null) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [editingRowId]);

  const campusOptions = useMemo(() => {
    const ck = view.presentation?.campusFieldKey;
    if (!ck) {
      return [];
    }
    const set = new Set<string>();
    for (const row of view.rows) {
      const raw = row.fieldMap[ck]?.textValue ?? "";
      set.add(normalizeCampusDisplay(raw));
    }
    return [...set].sort((a, b) => a.localeCompare(b, "en"));
  }, [view.rows, view.presentation?.campusFieldKey]);

  const rowsAfterCampus = useMemo(() => {
    const p = view.presentation;
    if (!groupingOn || !p?.campusFieldKey || selectedCampus === null) {
      return view.rows;
    }
    const ck = p.campusFieldKey;
    return view.rows.filter((row) => normalizeCampusDisplay(row.fieldMap[ck]?.textValue ?? "") === selectedCampus);
  }, [view.rows, view.presentation, groupingOn, selectedCampus]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    
    // §12.10 Filter interlock: ensure editing row stays visible
    const isEditingMatch = (row: ResolvedViewRow) =>
      editingRowId !== null && (row.id === editingRowId || row.mergedSourceRowIds?.includes(editingRowId));

    let filtered = rowsAfterCampus;
    if (q) {
      filtered = rowsAfterCampus.filter((row) => getSearchableText(view, row).includes(q));
    }

    if (editingRowId !== null) {
      const editingRow = view.rows.find(isEditingMatch);
      if (editingRow && !filtered.some(r => r.id === editingRow.id)) {
        // Add back to the end or keep in place? Let's append for simplicity in this milestone.
        filtered = [...filtered, editingRow];
      }
    }

    return filtered;
  }, [view, searchQuery, rowsAfterCampus, editingRowId]);

  const filteredView = useMemo(
    () => ({ ...view, rows: filteredRows, rowCount: filteredRows.length }),
    [view, filteredRows],
  );

  const fullProgramGroups = useMemo(() => {
    const p = view.presentation;
    if (!isCampusGroupingActive(p) || !p?.programGroupFieldKey || !p?.campusFieldKey) {
      return undefined;
    }
    return groupResolvedRows(view.rows, p.programGroupFieldKey, p.campusFieldKey);
  }, [view.rows, view.presentation]);

  const programGroups = useMemo(() => {
    if (!fullProgramGroups) {
      return undefined;
    }
    return narrowProgramGroupsToFilteredRows(fullProgramGroups, filteredRows);
  }, [fullProgramGroups, filteredRows]);

  const letterToRowId = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of filteredView.rows) {
      const letter = getIndexLetter(view, row);
      if (!map.has(letter)) {
        map.set(letter, row.id);
      }
    }
    return map;
  }, [filteredView.rows, view]);

  const letterToGroupId = useMemo(() => {
    const map = new Map<string, string>();
    if (!programGroups?.length) {
      return map;
    }
    for (const g of programGroups) {
      const letter = indexLetterFromLabel(g.label);
      if (!map.has(letter)) {
        map.set(letter, g.id);
      }
    }
    return map;
  }, [programGroups]);

  const activeLetters = useMemo(() => {
    const acc = new Set<string>();
    if (programGroups?.length) {
      for (const g of programGroups) {
        acc.add(indexLetterFromLabel(g.label));
      }
      return acc;
    }
    for (const row of filteredView.rows) {
      acc.add(getIndexLetter(view, row));
    }
    return acc;
  }, [programGroups, filteredView.rows, view]);

  const countSummary = useMemo(() => {
    if (contributorRowsFiltered) {
      return `${filteredView.rowCount} of ${view.rowCount} your rows`;
    }
    if (isCampusGroupingActive(view.presentation)) {
      const pCount = programGroups?.length ?? 0;
      return `${pCount} program${pCount === 1 ? "" : "s"} · ${filteredView.rowCount} of ${view.rowCount} listings`;
    }
    return `${filteredView.rowCount} of ${view.rowCount} rows`;
  }, [contributorRowsFiltered, filteredView.rowCount, view.rowCount, programGroups, view.presentation]);

  const editableRowIdSet = useMemo(() => new Set(editableRowIds), [editableRowIds]);
  const editingRow = useMemo(() => {
    if (editingRowId == null) {
      return null;
    }
    return (
      view.rows.find(
        (row) => row.id === editingRowId || row.mergedSourceRowIds?.includes(editingRowId),
      ) ?? null
    );
  }, [editingRowId, view.rows]);

  function scrollToLetter(letter: string) {
    if (programGroups?.length) {
      const groupId = letterToGroupId.get(letter);
      if (groupId != null) {
        document.getElementById(`group-${groupId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        setActiveLetter(letter);
        setTimeout(() => setActiveLetter(null), 800);
        return;
      }
    }
    const rowId = letterToRowId.get(letter);
    if (rowId != null) {
      document.getElementById(`row-${rowId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveLetter(letter);
      setTimeout(() => setActiveLetter(null), 800);
    }
  }

  async function handleSignOut() {
    if (adminUnrestrictedEditing) {
      toast.addToast("End your admin session from the Admin sign-out control.", "info");
      return;
    }
    if (!slug) {
      return;
    }

    const response = await fetch(`/api/public/views/${slug}/sign-out`, { method: "POST" });
    if (!response.ok) {
      toast.addToast("Unable to sign out.", "error");
      return;
    }

    toast.addToast("Signed out.", "success");
    startTransition(() => {
      router.refresh();
    });
  }

  function handleEditRow(rowId: number, triggerElement?: HTMLElement | null) {
    if (!editableRowIdSet.has(rowId)) {
      return;
    }
    editReturnFocusRef.current = triggerElement ?? null;
    setEditingRowId(rowId);
  }

  const showSearchAndIndex = !embed && view.rows.length > 0;
  const showAlphabetIndex = !contributorRowsFiltered || view.rows.length > 15;
  const contributorContextValue = {
    email: contributorEmail,
    viewId,
    editingConfig,
    editableRowIds,
    isAdminUnrestrictedEditing: adminUnrestrictedEditing,
    signOut: handleSignOut,
  };

  // For CF-1 through CF-4: Inline editing for all row/card layouts; Table stays in drawer.
  const isInlineLayout = layout !== "table";
  const showDrawer = editingRowId !== null && !isInlineLayout;

  return (
    <ContributorProvider value={contributorContextValue}>
      <DisplayTimezoneProvider timeZone={view.displayTimeZone}>
        <ViewValueLinkProvider
          value={{
            linkEmailsInView: filteredView.linkEmailsInView,
            linkPhonesInView: filteredView.linkPhonesInView,
          }}
        >
          <div className="relative">
        {!embed && editingConfig && (contributorEmail || adminUnrestrictedEditing) && (
          <div className="view-surface-muted mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-[color:var(--wsu-border)] px-4 py-3 text-sm text-[color:var(--wsu-muted)]">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium text-[color:var(--wsu-ink)]">
                {adminUnrestrictedEditing ? (
                  <>
                    Administrator: {adminEditingLabel ?? "signed in"} — all rows editable (same fields as contributors)
                  </>
                ) : (
                  <>Editing as {contributorEmail}</>
                )}
              </span>
              <span>
                {adminUnrestrictedEditing
                  ? "Row contact restrictions are not applied for administrators."
                  : contributorRowsFiltered
                    ? `Showing only your ${editableRowIds.length} assigned row${editableRowIds.length === 1 ? "" : "s"}`
                    : `${editableRowIds.length} editable row${editableRowIds.length === 1 ? "" : "s"} in this view`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {printHref ? (
                <Link href={printHref} className="link-pill-muted px-3 py-1.5 text-sm">
                  Print / PDF
                </Link>
              ) : null}
              {contributorInstructionsHref ? (
                <Link
                  href={contributorInstructionsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Opens contributor instructions in a new window"
                  className="link-pill-muted px-3 py-1.5 text-sm"
                >
                  Contributor instructions
                </Link>
              ) : null}
              {!adminUnrestrictedEditing ? (
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="link-pill-muted px-3 py-1.5 text-sm"
                >
                  Sign out
                </button>
              ) : (
                <span className="text-xs text-[color:var(--wsu-muted)]">Use Admin to sign out</span>
              )}
            </div>
          </div>
        )}

        {showSearchAndIndex && (
          <div className="mb-4 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    contributorRowsFiltered
                      ? "Search within your assigned rows..."
                      : "Search programs, names, emails..."
                  }
                  className="view-input w-full rounded-xl px-4 py-2.5 pl-10 text-sm"
                  aria-label={contributorRowsFiltered ? "Search your assigned rows" : "Search"}
                />
                <svg
                  className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--wsu-muted)]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="text-sm text-[color:var(--wsu-muted)]" aria-live="polite" aria-atomic="true">
                {countSummary}
              </span>
            </div>

            {showCampusStrip && campusOptions.length > 1 ? (
              <div
                className="flex flex-wrap items-center gap-2"
                role="group"
                aria-label="Filter by campus"
              >
                <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--wsu-muted)]">Campus</span>
                <button
                  type="button"
                  aria-pressed={selectedCampus === null}
                  onClick={() => setSelectedCampus(null)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    selectedCampus === null
                      ? "border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)] text-white"
                      : "border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)]"
                  }`}
                >
                  All
                </button>
                {campusOptions.map((campus) => {
                  const on = selectedCampus === campus;
                  return (
                    <button
                      key={campus}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setSelectedCampus(on ? null : campus)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        on
                          ? "border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)] text-white"
                          : "border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-ink)] hover:border-[color:var(--wsu-crimson)]"
                      }`}
                    >
                      {campus}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}

        <div className={showSearchAndIndex && showAlphabetIndex ? "flex items-start gap-3" : ""}>
          <div className="min-w-0 flex-1">
            <PublicViewRenderer
              layout={layout}
              view={filteredView}
              programGroups={programGroups}
              editableRowIds={editableRowIdSet}
              onEditRow={
                canOpenContributorEditor(embed, contributorEmail, editingConfig, adminUnrestrictedEditing)
                  ? handleEditRow
                  : undefined
              }
              editingRowId={editingRowId}
              onCancelEdit={() => setEditingRowId(null)}
              slug={slug}
            />
          </div>

          {showSearchAndIndex && showAlphabetIndex && (
            <nav
              aria-label="Alphabetical index"
              className="sticky top-6 shrink-0 flex flex-col gap-0.5 rounded-lg border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)]/95 px-1.5 py-2 shadow-lg backdrop-blur-sm"
            >
              {["#", ...ALPHABET].map((letter) => {
                const hasEntries = activeLetters.has(letter);
                const isActive = activeLetter === letter;
                return (
                  <button
                    key={letter}
                    type="button"
                    onClick={() => hasEntries && scrollToLetter(letter)}
                    disabled={!hasEntries}
                    className={`flex h-6 w-6 items-center justify-center rounded text-xs font-medium transition ${
                      hasEntries
                        ? isActive
                          ? "bg-[color:var(--wsu-crimson)] text-white"
                          : "text-[color:var(--wsu-crimson)] hover:bg-[color:var(--wsu-crimson)]/10"
                        : "cursor-default text-[color:var(--wsu-border)]"
                    }`}
                    title={hasEntries ? `Jump to ${letter}` : `No entries for ${letter}`}
                    aria-label={
                      hasEntries ? `Jump to entries starting with ${letter === "#" ? "number or symbol" : letter}` : `No entries for ${letter}`
                    }
                  >
                    {letter}
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        <EditRowDrawer
          slug={slug}
          view={filteredView}
          row={editingRow}
          open={showDrawer}
          onClose={() => setEditingRowId(null)}
          returnFocusRef={editReturnFocusRef}
        />
          </div>
        </ViewValueLinkProvider>
      </DisplayTimezoneProvider>
    </ContributorProvider>
  );
}
