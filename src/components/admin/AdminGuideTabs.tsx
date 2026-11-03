"use client";

import Link from "next/link";
import { useState } from "react";

type AdminGuideTabId = "overview" | "sources" | "setup" | "fields" | "editing" | "publish";

type AdminGuideTab = {
  id: AdminGuideTabId;
  label: string;
};

const TABS: AdminGuideTab[] = [
  { id: "overview", label: "Overview" },
  { id: "sources", label: "Sources" },
  { id: "setup", label: "Setup & Layout" },
  { id: "fields", label: "Fields & Display" },
  { id: "editing", label: "Editing & Groups" },
  { id: "publish", label: "Preview & Publish" },
];

function TabButton({
  id,
  label,
  activeTab,
  onSelect,
}: {
  id: AdminGuideTabId;
  label: string;
  activeTab: AdminGuideTabId;
  onSelect: (next: AdminGuideTabId) => void;
}) {
  const active = activeTab === id;
  return (
    <button
      id={`admin-guide-tab-${id}`}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`admin-guide-panel-${id}`}
      onClick={() => onSelect(id)}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)] text-white"
          : "border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
      }`}
    >
      {label}
    </button>
  );
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="font-serif text-lg font-medium tracking-[-0.01em] text-ink sm:text-xl">{title}</h2>
      {description ? <p className="mt-2 max-w-[68ch] text-[13px] leading-6 text-sub sm:text-sm">{description}</p> : null}
    </div>
  );
}

export function AdminGuideTabs() {
  const [activeTab, setActiveTab] = useState<AdminGuideTabId>("overview");

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/10 p-4">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Admin guide sections">
          {TABS.map((tab) => (
            <TabButton key={tab.id} id={tab.id} label={tab.label} activeTab={activeTab} onSelect={setActiveTab} />
          ))}
        </div>
      </div>

      {activeTab === "overview" && (
        <section id="admin-guide-panel-overview" role="tabpanel" aria-labelledby="admin-guide-tab-overview" className="space-y-6">
          <SectionTitle
            title="How to use this admin"
            description="Smartsheet is still the source of truth. This app controls how live Smartsheet data is presented, filtered, branded, and optionally edited by contributors."
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Main workflow</h3>
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li>Create a Smartsheet source.</li>
                <li>Create a view connected to that source.</li>
                <li>Configure setup, fields, filters, editing, and branding.</li>
                <li>Preview the output.</li>
                <li>Publish when the page looks right.</li>
              </ol>
            </div>

            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Before you start</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li><code className="rounded bg-[color:var(--wsu-stone)]/40 px-1.5 py-0.5 text-xs">SMARTSHEET_API_TOKEN</code> must be valid.</li>
                <li><code className="rounded bg-[color:var(--wsu-stone)]/40 px-1.5 py-0.5 text-xs">DATABASE_URL</code> must point to your production database on Railway or any other non-durable host. Local file mode is fine only for local/dev work.</li>
                <li>If contributor editing is enabled, <code className="rounded bg-[color:var(--wsu-stone)]/40 px-1.5 py-0.5 text-xs">CONTRIBUTOR_SESSION_SECRET</code> must be set.</li>
                <li>If you use Supabase, backend-owned public tables must keep RLS enabled and the current app role must still have the generated access policy.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-5 text-sm text-amber-950 sm:text-base">
            <p className="font-semibold">Important password note</p>
            <p className="mt-2 leading-relaxed">
              Contributor passwords are stored as one-way hashes. Admins cannot view them. If someone forgets a password, use a reset link from the Contributors area instead.
            </p>
          </div>

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Admin session cookies</h3>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              Admin sign-in uses stateless, signed httpOnly cookies. Set a dedicated{" "}
              <code className="rounded bg-[color:var(--wsu-stone)]/40 px-1 py-0.5 text-xs">SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET</code> in production.
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <li>
                <strong className="text-[color:var(--wsu-ink)]">Rotate the secret</strong> to log every admin out immediately after an incident or suspected cookie leak.
              </li>
              <li>
                If the secret is <strong className="text-[color:var(--wsu-ink)]">unset</strong>, the app derives signing material from the bootstrap username and password — changing the password then invalidates all admin sessions.
              </li>
              <li>
                On hosts with multiple environments, configure the secret per environment so Preview and Production behave predictably.
              </li>
            </ul>
          </div>
        </section>
      )}

      {activeTab === "sources" && (
        <section id="admin-guide-panel-sources" role="tabpanel" aria-labelledby="admin-guide-tab-sources" className="space-y-6">
          <SectionTitle
            title="Create and test sources"
            description="A source tells the app which Smartsheet sheet or report to read. A view cannot work until the source is valid."
          />

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">What to enter</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <li><strong className="text-[color:var(--wsu-ink)]">Source ID:</strong> internal identifier used by the app.</li>
              <li><strong className="text-[color:var(--wsu-ink)]">Label:</strong> human-friendly name shown in admin and public headers.</li>
              <li><strong className="text-[color:var(--wsu-ink)]">Source type:</strong> choose <code className="rounded bg-[color:var(--wsu-stone)]/40 px-1 py-0.5 text-xs">sheet</code> or <code className="rounded bg-[color:var(--wsu-stone)]/40 px-1 py-0.5 text-xs">report</code>.</li>
              <li><strong className="text-[color:var(--wsu-ink)]">Smartsheet ID:</strong> the numeric ID from the Smartsheet URL.</li>
            </ul>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              After saving, always run <strong className="text-[color:var(--wsu-ink)]">Test + Fetch Schema</strong>. That verifies the connection and loads the column list into the browser for role-group mapping. If it fails, fix the source before building views.
            </p>
          </div>

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Role groups on this source</h3>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <li>
                Open <strong className="text-[color:var(--wsu-ink)]">Schema preview</strong> and run <strong className="text-[color:var(--wsu-ink)]">Merge detected role groups</strong> if you want the app to suggest groups from column title patterns (optional starting point).
              </li>
              <li>
                Scroll to <strong className="text-[color:var(--wsu-ink)]">Role groups</strong>. Run <strong className="text-[color:var(--wsu-ink)]">Fetch schema now</strong> or use <strong className="text-[color:var(--wsu-ink)]">Test + Fetch Schema</strong> first — column mapping uses <strong className="text-[color:var(--wsu-ink)]">dropdowns</strong> only after the schema is loaded in this session.
              </li>
              <li>
                For <strong className="text-[color:var(--wsu-ink)]">numbered slots</strong>, edit slot IDs and pick Smartsheet columns for name, email, and phone per row; add or remove slots as needed. <strong className="text-[color:var(--wsu-ink)]">Save source</strong> when done.
              </li>
              <li>
                If a view used separate columns for a contact and you switch to one <strong className="text-[color:var(--wsu-ink)]">grouped role</strong> field on the Fields tab, update that view&apos;s{" "}
                <strong className="text-[color:var(--wsu-ink)]">Setup → Custom card layout</strong> so rows no longer reference the removed field keys.
              </li>
              <li>
                For <strong className="text-[color:var(--wsu-ink)]">delimited parallel</strong> groups, map columns in the same section; optional delimiter tokens are separated with <code className="rounded bg-[color:var(--wsu-stone)]/40 px-1 py-0.5 text-xs">|</code> (see the field hint for{" "}
                <code className="rounded bg-[color:var(--wsu-stone)]/40 px-1 py-0.5 text-xs">\n</code> and <code className="rounded bg-[color:var(--wsu-stone)]/40 px-1 py-0.5 text-xs">\|</code>).
              </li>
            </ol>
          </div>

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Common source problems</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <li>Wrong source type selected.</li>
              <li>Smartsheet ID copied incorrectly.</li>
              <li>Token lacks access to the sheet or report.</li>
              <li>Using local-only storage instead of a real database in production.</li>
            </ul>
          </div>
        </section>
      )}

      {activeTab === "setup" && (
        <section id="admin-guide-panel-setup" role="tabpanel" aria-labelledby="admin-guide-tab-setup" className="space-y-6">
          <SectionTitle
            title="Setup tab and layout controls"
            description="Use Setup to define the structure, branding, and page furniture before you fine-tune field behavior."
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Basic view details</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li><strong className="text-[color:var(--wsu-ink)]">Source:</strong> the Smartsheet source this view reads from.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Label:</strong> the public-facing name for the page.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Slug:</strong> the URL path.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">View ID:</strong> set at creation time and then treated as fixed.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Description:</strong> optional supporting copy.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Tab order:</strong> controls order when multiple views share a slug.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Layout presets and overrides</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li>Start with a preset to get a sensible page pattern quickly.</li>
                <li>Use the layout override if you want the same fields in a different presentation such as table, cards, accordion, tabbed, or list/detail.</li>
                <li>For card-style layouts, pick heading and summary fields so the public cards read correctly.</li>
                <li>
                  Use <strong className="text-[color:var(--wsu-ink)]">Custom card layout</strong> when you want multiple fields on one row, placeholder blanks for
                  alignment, or static labels inside the card. Each <strong className="text-[color:var(--wsu-ink)]">field</strong> slot is tied to that field&apos;s{" "}
                  <strong className="text-[color:var(--wsu-ink)]">key</strong> on the Fields tab. After you remove or rename a field, or merge separate contact
                  columns into one <strong className="text-[color:var(--wsu-ink)]">grouped role</strong> field, open Custom card layout again and fix any rows that
                  still reference old keys — the save error names the row and key to change.
                </li>
              </ul>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Page Header & Branding</h3>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                This section controls the top band of the public page. Use it to decide whether the page opens with a branded header, a lighter utility header, or almost no header furniture at all.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li><strong className="text-[color:var(--wsu-ink)]">Show page header</strong> turns the full header region on or off.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Custom header text</strong> lets you add a short eyebrow or supporting line above the page title.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Show logo / branding</strong> controls the WSU lockup or branded mark.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Show back link</strong>, <strong className="text-[color:var(--wsu-ink)]">Show source label</strong>, <strong className="text-[color:var(--wsu-ink)]">Show page title</strong>, and <strong className="text-[color:var(--wsu-ink)]">Show live data text</strong> let you trim the header down to only the context you want.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Status box and content area</h3>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                Below the main header, you can decide how much context the page shows before the data starts.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li><strong className="text-[color:var(--wsu-ink)]">Status / Info Box</strong> can show the active view name, row count, last refresh time, contributor sign-in link, and contributor instructions link.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Content Area</strong> controls the title section, view tabs, row counts on tabs, custom tab labels, and the layout switcher below the header.</li>
                <li>If contributor editing is enabled, this is also where you decide whether the public page advertises contributor sign-in and the contributor help page.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Print / PDF grouping and live links</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <li>
                <strong className="text-[color:var(--wsu-ink)]">Print / PDF grouping</strong> lets you group rows on the{" "}
                <code className="rounded bg-[color:var(--wsu-stone)]/40 px-1 py-0.5 text-xs">/view/…/print</code> route by one{" "}
                <strong className="text-[color:var(--wsu-ink)]">non-hidden</strong> field (for example one table per program).
              </li>
              <li>
                <strong className="text-[color:var(--wsu-ink)]">Link email addresses</strong> and{" "}
                <strong className="text-[color:var(--wsu-ink)]">Link phone numbers</strong> apply to the interactive public page only; print / PDF output stays plain text.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Campus, sections, and merged rows</h3>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              Use <strong className="text-[color:var(--wsu-ink)]">Campus &amp; program grouping (live view)</strong> in Setup for program and campus fields, optional section grouping, and optional row merge.
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <li>
                <strong className="text-[color:var(--wsu-ink)]">Merge by shared email</strong> is for the same contacts on multiple campus lines; other columns should match—the app unions campuses and uses the first row for remaining fields.
              </li>
              <li>
                <strong className="text-[color:var(--wsu-ink)]">Merge by same program and campus</strong> collapses duplicate sheet rows; first row wins for contacts and other fields.
              </li>
              <li>
                After merge, <strong className="text-[color:var(--wsu-ink)]">custom card layout</strong> shows each field key once (repeated layout slots collapse) on the public page and in the contributor editor.
              </li>
            </ul>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Theme preset</h3>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                Start with a theme preset. A preset gives you a complete baseline palette so the page feels coherent before you start fine-tuning individual tokens.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li>Pick the preset that is closest to the final tone you want.</li>
                <li>Use presets to keep the page aligned with institutional branding or a specific campaign look.</li>
                <li>Changing the preset after heavy customization will reset custom overrides.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Customize look & feel</h3>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                Use <strong className="text-[color:var(--wsu-ink)]">Customize look & feel</strong> only after the preset is close. These controls add overrides on top of the preset rather than replacing the whole theme.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li><strong className="text-[color:var(--wsu-ink)]">Colors:</strong> page background, card background, accent color, text, muted text, borders, and badges.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Typography:</strong> body font, heading font, sizes, weights, and styles.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Shape & shadow:</strong> corner radius and card shadow.</li>
                <li>Overrides can be cleared one token at a time to return to the preset default.</li>
                <li>Pay attention to contrast warnings when changing accent or text colors.</li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {activeTab === "fields" && (
        <section id="admin-guide-panel-fields" role="tabpanel" aria-labelledby="admin-guide-tab-fields" className="space-y-6">
          <SectionTitle
            title="Fields, display names, and field behavior"
            description="The Fields tab is where you choose which Smartsheet columns appear and how they behave in the public page."
          />

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Basic field workflow</h3>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <li>Load columns from the selected source.</li>
              <li>Check the columns you want to include.</li>
              <li>Edit display names if the public label should differ from the Smartsheet column title.</li>
              <li>Use Arrange to reorder or remove fields.</li>
              <li>
                If this view uses <strong className="text-[color:var(--wsu-ink)]">Custom card layout</strong> and you remove fields or add a grouped role field in place of old columns, edit Setup → Custom card layout so every slot matches a field that still exists.
              </li>
              <li>Use live preview to see the result as you work.</li>
            </ol>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Render and transform controls</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li><strong className="text-[color:var(--wsu-ink)]">Render as:</strong> text, badge, mailto, list, phone list, and more.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Transforms:</strong> split, format date, contact emails, contact names, reset to source, and similar cleanup rules.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">List display:</strong> stacked or inline, with a custom delimiter when inline.</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Visibility and emphasis</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li><strong className="text-[color:var(--wsu-ink)]">Heading:</strong> main field for cards and accordions.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Summary:</strong> secondary field for cards and accordions.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Hide label:</strong> suppresses the field label while keeping the value.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">Hide when empty:</strong> removes the field entirely when the value is blank.</li>
                <li><strong className="text-[color:var(--wsu-ink)]">A-Z index:</strong> picks the field used for the alphabetical jump strip.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">When to use Hide when empty</h3>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              Use <strong className="text-[color:var(--wsu-ink)]">Hide when empty</strong> when a field only applies to some rows. This keeps cards and tables from showing empty labels for optional data such as role-specific contacts, program notes, or secondary locations.
            </p>
          </div>
        </section>
      )}

      {activeTab === "editing" && (
        <section id="admin-guide-panel-editing" role="tabpanel" aria-labelledby="admin-guide-tab-editing" className="space-y-6">
          <SectionTitle
            title="Contributor editing and multi-person groups"
            description="The Editing tab controls whether contributors can update data and exactly which rows and fields they can touch."
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Who can edit</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li>Turn on <strong className="text-[color:var(--wsu-ink)]">Enable contributor editing</strong>.</li>
                <li>Select one or more <strong className="text-[color:var(--wsu-ink)]">Contact Columns</strong>.</li>
                <li>
                  If a contributor&apos;s{" "}
                  <code className="rounded bg-[color:var(--wsu-stone)]/40 px-1 py-0.5 text-xs">@wsu.edu</code> email
                  appears in one of those columns on a row, they can claim access to that row.
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">What they can edit</h3>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li><strong className="text-[color:var(--wsu-ink)]">Editable Fields</strong> define what can be changed.</li>
                <li>Contact columns define <em>who</em> can edit, not <em>what</em> they can edit.</li>
                <li>You must choose at least one editable field or add a multi-person group.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Multi-person field groups</h3>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <strong className="text-[color:var(--wsu-ink)]">Source role groups</strong> (under Admin → Sources → Role groups) define how numbered or delimited Smartsheet columns tie together. Views use a{" "}
              <code className="rounded bg-[color:var(--wsu-stone)]/40 px-1 py-0.5 text-xs">people_group</code> field to display that bundle.{" "}
              <strong className="text-[color:var(--wsu-ink)]">Editing → Multi-person field groups</strong> on the view is a separate tool for comma-separated columns when you are not using a source role group.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              Use view-level groups when the sheet stores repeated people data across separate columns, such as coordinator names, coordinator emails, and coordinator phone numbers. A group turns that raw Smartsheet data into one card per person with structured fields such as name, email, and phone.
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <li>Create a group label that describes the role, such as &quot;Program coordinators&quot;.</li>
              <li>Map the group&apos;s name, email, and phone attributes to the appropriate view fields.</li>
              <li>Contributors will then get <strong className="text-[color:var(--wsu-ink)]">Add person</strong>, <strong className="text-[color:var(--wsu-ink)]">Remove</strong>, and sometimes <strong className="text-[color:var(--wsu-ink)]">Clear everyone</strong> instead of a single plain-text box.</li>
            </ul>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
              <p className="font-semibold">Order matters</p>
              <p className="mt-2 leading-relaxed">
                Grouped people are matched by position across the mapped columns. The first name is paired with the first email and first phone, the second name with the second email and second phone, and so on.
              </p>
              <p className="mt-2 leading-relaxed">
                Example: <code className="rounded bg-white px-1.5 py-0.5 text-xs">Jane Doe, Bob Smith</code> must line up with <code className="rounded bg-white px-1.5 py-0.5 text-xs">doe@wsu.edu, smith@wsu.edu</code>. If the order or count does not match, the wrong people will be paired together in some views.
              </p>
            </div>
            <div className="mt-4 rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/15 p-4 text-sm text-[color:var(--wsu-muted)]">
              <p className="font-medium text-[color:var(--wsu-ink)]">Delimiter rules</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Commas, semicolons, and line breaks are all treated as separators.</li>
                <li>The app does not preserve delimiter style as a separate meaning. It only cares about the person order.</li>
                <li>Plain-text and phone values save back to Smartsheet as comma-separated text.</li>
                <li>Contact columns still keep the same person order when they are written back.</li>
              </ul>
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Public contributor links</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <li><strong className="text-[color:var(--wsu-ink)]">Show contributor login link</strong> controls whether the public page shows sign-in entry.</li>
              <li><strong className="text-[color:var(--wsu-ink)]">Show contributor instructions link</strong> adds a public help link that opens in a new window.</li>
              <li>Hiding those links does not remove editing for people who already have the direct URL or an active session.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50/80 p-5 text-sm text-sky-950 sm:text-base">
            <p className="font-semibold">Administrators on the live public page</p>
            <p className="mt-2 leading-relaxed">
              If you stay signed in to Admin and open the published public view in the <strong className="text-sky-950">same browser</strong>, you may be able to edit{" "}
              <strong className="text-sky-950">any row</strong> when contributor editing is enabled — same fields as contributors, but no contact-column filter. Use for support; sign out when finished. Writes still go to Smartsheet.
            </p>
          </div>
        </section>
      )}

      {activeTab === "publish" && (
        <section id="admin-guide-panel-publish" role="tabpanel" aria-labelledby="admin-guide-tab-publish" className="space-y-6">
          <SectionTitle
            title="Preview, publish, and operate the site"
            description="Use preview deliberately. Publishing should be the last step, not the first check."
          />

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Preview workflow</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <li>Use live preview while mapping fields.</li>
              <li>Use the Preview tab for a fuller page-level check.</li>
              <li>Check layout, branding, tabs, A-Z behavior, search, and contributor links before publishing.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Exports</h3>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              On the View Builder toolbar, use <strong className="text-[color:var(--wsu-ink)]">Export JSON</strong> for a full config backup or{" "}
              <strong className="text-[color:var(--wsu-ink)]">Slim export</strong> for a smaller file with rows and display-oriented values. Use{" "}
              <strong className="text-[color:var(--wsu-ink)]">Restore from JSON…</strong> to reload a backup (full export or <code className="text-xs">view</code> from the admin API); slim-only files cannot restore settings. All require an admin session.
            </p>
          </div>

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Schema drift and refreshes</h3>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <li>If a Smartsheet column is renamed or removed, publishing may block until mappings are corrected.</li>
              <li>Refresh schema when source columns changed.</li>
              <li>Re-check contributor contact columns and editable fields after schema changes.</li>
            </ul>
          </div>

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Release checklist</h3>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <li>Confirm environment values and database connectivity.</li>
              <li>Confirm RLS is enabled on backend-owned public tables and that the current <code className="rounded bg-[color:var(--wsu-stone)]/40 px-1 py-0.5 text-xs">DATABASE_URL</code> role still has the generated access policy.</li>
              <li>Preview the public page and verify layout, filters, search, branding, and contributor links.</li>
              <li>If contributor editing is enabled, test first-time access, sign-in, row eligibility, save to Smartsheet, and password reset.</li>
              <li>Commit and push before expecting a Git-based deploy to pick up changes.</li>
            </ol>
          </div>

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Contributor accounts</h3>
            <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              When <strong className="text-[color:var(--wsu-ink)]">DATABASE_URL</strong> and contributor editing are enabled, open{" "}
              <Link href="/admin/contributors" className="font-medium text-[color:var(--wsu-crimson)] underline-offset-2 hover:underline">
                Admin → Contributors
              </Link>{" "}
              to manage accounts without touching the database directly.
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
              <li>
                Generate a <strong className="text-[color:var(--wsu-ink)]">single-use reset link</strong> (24-hour TTL), copy it, and send it to
                the contributor manually. The link is invalidated after a successful password change.
              </li>
              <li>
                <strong className="text-[color:var(--wsu-ink)]">Remove account</strong> when someone should no longer sign in; if their email
                still appears in a contact column, they can go through first-time access again later.
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-muted)]">Related guides</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/instructions/contributor" className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-crimson)] hover:underline">
                Contributor guide
              </Link>
              <Link href="/admin/contributors" className="rounded-full border border-[color:var(--wsu-border)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--wsu-crimson)] hover:underline">
                Contributors admin
              </Link>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
