# Admin Instructions

Use this guide to connect Smartsheet sources, build public views, publish changes, and manage contributor access.

## Overview

This app does not replace Smartsheet. Smartsheet is still the source of truth. The admin builder controls how that data is displayed, filtered, branded, and optionally edited by contributors.

Main workflow:

1. Create a source.
2. Create a view connected to that source.
3. Configure setup, fields, filters, editing, and branding.
4. Preview the result.
5. Publish when it is ready.

Contributor passwords are stored as one-way hashes and cannot be viewed by admins. Use reset links instead.

## Before You Start

Required environment values:

- `SMARTSHEET_API_TOKEN`
- `SMARTSHEETS_VIEW_ADMIN_USERNAME`
- `SMARTSHEETS_VIEW_ADMIN_PASSWORD`
- `SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET`
- `DATABASE_URL` for Railway or any production environment where local files are not durable; optional for local file-backed development
- `CONTRIBUTOR_SESSION_SECRET` if contributor editing is enabled
- `SMARTSHEETS_VIEW_DATABASE_INSECURE_SSL` — optional; set to `true` only if Postgres TLS verification fails after review and you deliberately accept relaxed TLS. Prefer fixing `DATABASE_URL` or provider certificates first. When `false` or unset, the app strips `sslmode=no-verify` from the URL unless this flag is `true`.
- `SMARTSHEETS_VIEW_PUBLIC_BASE_URL` — optional; set this if `{{PUBLIC_URL}}` should always point at a fixed external origin instead of using trusted forwarded headers

### Admin session cookies

Admin sign-in uses **stateless** httpOnly cookies: HMAC-signed with `SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET`, or with material **derived from** bootstrap username + password when that variable is unset. There is **no** server-side session *table*—but each sensitive request still **resolves the principal** (bootstrap env user or **managed** admin from Postgres / local admin-user files). Middleware uses an internal **`/api/admin/verify-session`** check when a cookie is present so deactivated or deleted managed admins lose access promptly, not only after cookie expiry.

- **Production:** Always set `SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET` to a strong random value (never empty). **Rotating** this secret **immediately** invalidates **all** admin sessions everywhere that uses the new value — use this after incidents or suspected cookie leaks for **bootstrap** sessions; managed admins are also re-checked against live records as above.
- **If the secret is unset:** Changing the bootstrap admin **password** changes the derived key and **invalidates all admin cookies** — keep that in mind during password rotations.
- **Multiple environments:** Set the secret per environment (Production, Preview, Development as used). Preview without its own secret falls back to the password-derived model for Preview.
- **Sign out** in the admin UI only clears the cookie on that browser.

If you use Supabase for Postgres:

- backend-owned tables in `public` must keep RLS enabled
- backend-owned tables also need an app-role policy so the `DATABASE_URL` role can read and write after RLS is enabled
- update `sql/enable-public-rls.sql` when a new backend-owned `public` table is added
- rerun the bootstrap/script path if you change the `DATABASE_URL` role later
- rerun Supabase Security Advisor after deploy and treat new `rls_disabled_in_public` findings as release-blocking

## Sources

A source tells the app which Smartsheet sheet or report to read.

When creating a source, enter:

- a Source ID for internal use (letters, numbers, hyphens, underscores only; enforced on save)
- a Label for the admin and public UI
- the source type: `sheet` or `report`
- the numeric Smartsheet ID from the URL

After saving, always use `Test + Fetch Schema`. That checks connectivity and loads the column list into the browser. Column mapping dropdowns on the source page work only after the schema is loaded in that session (or use `Fetch schema now` in the role-groups area).

### Role groups on sources

Use `Schema preview` first if you want a read-only look at columns. Optional: use `Merge detected role groups` to pull in numbered role patterns from Smartsheet column titles.

Examples:

- `Department Chair or School Director Name 1`
- `Department Chair or School Director Email 1`
- `Faculty Graduate Program Coordinator or Designee 1`

Then configure the `Role groups` section on the source page:

- for **numbered slots**, edit slot IDs and pick Smartsheet columns for name, email, and phone per row; add or remove slots as needed; `Save source` when done
- **delimited parallel** groups use the same section; optional delimiter tokens in admin use a pipe `|` between tokens (see the field hint for line breaks `\n` and a literal pipe `\|`)
- numbered-slot groups are safe by structure and pair people by shared slot number
- single-attribute delimited groups are safe because there is no cross-column pairing
- multi-attribute delimited groups are read-only by default unless you explicitly enable `Trust positional pairing`

Only enable trusted pairing when you know the delimited name, email, and phone columns stay aligned in Smartsheet.

## Setup And Layout

Use the Setup tab to define the structure of the page.

Important controls:

- `Source`: which Smartsheet source the view reads from
- `Label`: the public-facing view name
- `Slug`: the URL path
- `View ID`: fixed after creation
- `Description`: optional supporting copy
- `Tab order`: order when multiple views share a slug
- `Heading field key`: primary card or accordion title
- `Summary field key`: secondary card or accordion text

### Layout presets and view structure

- start with a layout preset
- override the layout if needed: table, cards, accordion, tabbed, list/detail, and similar patterns
- for card-style layouts, use `Custom card layout` when you want multiple fields in one row, placeholders for alignment, or static text inside cards

### Page Header & Branding

Use this section to control the top band of the public page.

Key decisions:

- whether the page should show the full page header at all
- whether to add custom header text above the main title
- whether to show logo or lockup branding
- whether to show the back link, source label, page title, and live-data text

This is where you decide how branded or minimal the page feels before the user reaches the data.

### Status box and Content Area

Below the main header, you can control the supporting context shown above the data.

`Status / Info Box` can show:

- active view name
- row count
- last refresh time
- the contributor action stack, which groups `Contributor sign in`, `Print / PDF`, and `Contributor instructions`

`Content Area` controls:

- the title section below the header
- tabs when multiple views share the same slug
- row counts on tabs
- custom tab label text
- the layout switcher

### Print / PDF grouping and live column links

Optional Setup controls:

- **Print / PDF grouping** — pick a **non-hidden** field so the print route (`/view/.../print`) can show **one table per group** when values differ (for example program name).
- **Link email addresses** / **Link phone numbers** — turn `mailto:` / `tel:` on for the **interactive** public page; print / save-as-PDF output stays **plain text**.

### Campus, program sections, and merged rows

In **Setup**, open **Campus & program grouping (live view)** when you use a program field and campus field together.

- **Group into sections by program** stacks one section per program and can show campus chips or filters.
- **Merge duplicate sheet rows** combines multiple Smartsheet lines into one public row:
  - **Same program + same contact email(s)** — for one coordinator (or the same set of people emails) listed on separate campus lines. Only campus should differ; other columns are expected to match. The app unions campuses and keeps data from the first matching sheet row for non-campus fields.
  - **Same program + same campus** — for true duplicate lines (same offering repeated on the sheet); first row wins for contacts and other fields.

If **custom card layout** repeats the program (or other) column in more than one layout row, those repeats are shown **once** after a merge so the public card and contributor editor are not duplicated. Design Smartsheet data so merged lines stay consistent; conflicting values are not merged field-by-field.

### Theme preset and Customize look & feel

Use `Theme preset` first. A preset gives you a complete baseline palette so the page feels coherent before you start fine-tuning tokens.

Use `Customize look & feel` after that to layer overrides on top of the preset.

Customization controls include:

- colors: page background, card background, accent color, primary text, muted text, borders, and badges
- colors for muted surfaces and controls: control background, control text, control border, hover background, active background, and active text
- typography: body font, heading font, field label size/weight/spacing/transform, row heading size/weight, grouped people name weight, grouped people email/phone weight, and body/heading styles
- shape and shadow: border radius and card shadow

Important behavior:

- switching to a different preset resets your custom overrides
- individual overrides can be cleared back to the preset default
- watch the contrast indicator if you change accent or text colors

## Fields And Display

Use the Fields tab to choose what appears on the public page and how it renders.

Basic workflow:

1. Load columns from the selected source.
2. Check the columns you want.
3. Edit display names as needed.
4. Reorder or remove fields in `Arrange`.
5. Watch the live preview while you work.

Field controls include:

- `Render as`: text, badge, mailto, list, phone list, and others
- `Transforms`: split, format date, contact emails, contact names, reset to source, and similar cleanup rules
- `List display`: stacked or inline with a delimiter
- `Heading`: primary field for cards and accordions
- `Summary`: secondary field for cards and accordions
- `Hide label`: show the value without the field label
- `Hide when empty`: remove the field entirely when blank
- `A-Z index`: choose the field used for alphabetical navigation

The Fields tab can also add grouped role fields from the source:

- use `Add grouped role field` to append one `people_group` field backed by a source role group
- grouped role fields render under one shared header instead of exposing every numbered Smartsheet column separately
- if the linked source role group uses legacy delimited data, the field badge will tell you it is a delimited role group
- grouped role fields now support `People layout` so you can choose horizontal or vertical rendering
- grouped role fields also support `People style` so you can use a plain layout or a capsule treatment for each person block

Use `Hide when empty` for optional fields that only apply to some rows so the page does not show empty labels.

## Filters And Sort

Use Filters & Sort to narrow the rows and control the order users see.

- filters decide which rows appear
- default sort controls the order within the current view

If the page looks wrong but field mapping is correct, check filters and sort next.

## Exports

In **View Builder** (editing an existing view), use the toolbar links:

- **Export JSON** — full JSON backup of the view configuration path supported by the admin API.
- **Slim export** — smaller JSON with rows and display-oriented cell values (`?format=slim`); same admin session and permissions as full export.

## Editing And Groups

Use the Editing tab to control contributor editing.

Key rule:

- contact columns define **who** can edit
- editable fields and multi-person groups define **what** they can edit

Contributor access works like this:

- the contributor must have a `@wsu.edu` email in one of the selected contact columns on that row
- they can then claim access to that row
- they can edit only the selected editable fields or configured group fields

### Grouped role editing

The current preferred model is source-level role groups, not manually reconstructed comma-separated people data.

When a view contains a grouped role field:

- numbered-slot role groups derive contributor editing automatically
- fixed-slot groups keep each person tied to slot `1`, `2`, `3`, and so on
- fixed-slot groups do not show `Add person` or `Remove` because the slots are defined by the source columns
- trusted legacy delimited groups may still show add/remove behavior because they are serialized back as ordered delimited values
- unsafe multi-attribute delimited groups stay read-only in the contributor editor (inline or table drawer)

This protects against Smartsheet reordering parallel delimited columns and breaking name/email alignment.

### Legacy delimiters

**Cell values** (when the app parses multi-value text from Smartsheet): the parser treats all of these as separators:

- comma `,`
- semicolon `;`
- line breaks

This is separate from the **admin delimiter field** on a delimited source role group, where you configure token boundaries with pipe-separated entries and escapes as described in the source UI.

Important detail:

- delimiter style does not carry meaning by itself
- the app only cares about the order of people across the mapped columns when the group is explicitly trusted
- plain-text and phone values are saved back as comma-separated text
- contact columns still preserve the same person order when written back

Do not assume a multi-attribute delimited source is safe just because the values currently look aligned. If Smartsheet reorders one parallel column independently, the pairing becomes wrong.

The Editing tab also controls:

- `Show contributor login link`
- `Show contributor instructions link`

Hiding those links does not remove editing for someone who already has the direct URL or an active session.

### Administrators on the live public page

If you remain signed in to **Admin** and open the **published** public view in the same browser, the page can offer **unrestricted row editing** when contributor editing is enabled: same allowed fields as contributors, but **no** contact-column row filter. Use this for support and data fixes; changes still write to Smartsheet. Sign out of Admin when done. Emergency invalidation of **all** admin sessions: rotate `SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET` and redeploy (see **Admin session cookies** above). Ensure Preview and Production each have the secrets you expect so behavior is not confused across environments.

## Preview And Publish

Preview before you publish.

Recommended order:

1. use live preview while building fields
2. use the Preview tab for a fuller page-level review
3. publish only after checking layout, branding, filters, search, and contributor links

If publishing is blocked, schema drift is the usual cause. That means a required Smartsheet column was changed, removed, or renamed.

After schema changes:

- refresh schema
- recheck field mappings
- recheck source role groups
- recheck contributor contact columns and editable fields

### Print / save as PDF

Public views now include a print-friendly route. Use it when someone wants a printable or browser-generated PDF version of the current view.

- open the public view
- choose the print action
- review the print route output before saving to PDF
- the print route now defaults to a horizontal table layout and keeps grouped people compact within each cell

This is semantic HTML designed for browser print. It is not the same as a guaranteed tagged PDF / PDF-UA workflow.

Optional **Print / PDF grouping** (Setup) splits the print page into multiple tables when you choose a non-hidden grouping field.

## In-app workflows

Admins, Programs Team, and coordinators can open **Forms → Workflows** and pick a template. The Alert template posts to the in-app Notifications tab. Other templates can be saved as drafts until a later plan.

Smartsheet automations keep running at the same time. When in-app alerts are ready, Forms Manage → Automations can **turn off** listed Smartsheet rules. That disables them; it does not delete them. Grid Approve/Decline is unchanged.

## Release Checklist

1. Confirm environment values and database connectivity.
2. Confirm RLS is enabled on backend-owned public tables and that the current `DATABASE_URL` role still has the expected app-role policy.
3. Preview the public page and verify layout, filters, search, branding, and contributor links.
4. If contributor editing is enabled, test:
   - first-time access
   - sign in
   - row eligibility
   - save to Smartsheet
   - password reset flow
   - grouped contact editing when groups are enabled
   - read-only behavior for unsafe delimited grouped roles, if any exist
   - trusted pairing behavior if any source role group uses legacy delimited columns
5. Commit and push changes before expecting a Git-based deployment to pick them up.
