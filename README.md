# Smartsheet View

**Smartsheet is the source of truth. This app is the public window into it.**

Staff manage data in Smartsheet as they always have - no changes to their workflow. This Next.js app connects to Smartsheet and makes selected data available as clean, branded, and accessible public webpages without exposing the raw spreadsheet.

## Key Features

- **Visual Admin Builder**: Configure sources and public views with a five-section builder (**Setup**, **Fields**, **Filters & Sort**, **Editing**, **Preview**).
- **Custom Header WYSIWYG**: Rich text editor for page headers with headings, bold, italic, underline, alignment, bullet lists, text color, highlighting, and links. Use `{{PUBLIC_URL}}` to insert a live, clickable link to the current view.
- **Flexible Layouts**: Tables, Cards, Lists, Stacked, Accordions, Tabbed panels, and List / Detail.
- **Advanced Theme System**: Expanded design tokens for surfaces, controls, typography, row headings, field labels, grouped people names, and grouped people email/phone weight, with live WCAG AA contrast validation.
- **Smart Transforms**: Auto-suggest render types (e.g., Email -> mailto, Picklist -> badge) and data transformations (Split, Date Format).
- **Schema Drift Protection**: Automatic checks block publishing if Smartsheet columns are renamed or removed.
- **Universal Embed**: Standalone pages or iframe embeds for WordPress/CMS with automatic height reporting.
- **Grouped Role Fields**: Sources can define reusable role groups from numbered Smartsheet columns and add them to views as a single `people_group` field under one shared header.
- **Contributor Row Editing**: Smartsheet contacts (e.g., coordinators) can edit assigned rows on the public view (WSU email + password; row scope from contact columns; per-view editable fields and grouped role fields). Numbered-slot role groups are deterministic by structure; legacy multi-attribute delimited role groups stay read-only unless explicitly trusted at the source level. Requires Postgres and `CONTRIBUTOR_SESSION_SECRET` in production. **Table** layout uses a slide-out drawer; **other layouts** edit inline on the same card/list (card-faithful). **Administrators** signed in via the Admin app can edit **any** row on the same public view when editing is enabled (same allowed fields as contributors; no contact-column row restriction). Admin sessions use signed httpOnly cookies; set a dedicated `SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET` in production — see **Admin session cookies** below.
- **Print / PDF Phase 1**: Public views include a print-friendly route that defaults to a landscape-friendly semantic table for browser print or save-as-PDF.
- **Public accessibility**: Skip link, search **live regions**, landmark/nav labels, table **captions** / **scope**, **dialog** focus trap and return focus from **Edit**, **tab**/**tabpanel** patterns on public views.
- **Header branding (admin)**: In **Setup** > **Page header & branding**, optional PNG/JPEG logo (at most 256KB, **alt text** required for save) plus optional **two text lines** beside the logo (organization + unit), with a vertical rule - stored in view config. Shown at the top of the public header when visible.
- **Instruction pages**: `/instructions/contributor` (opens from a link on public views when enabled; no login to read) and `/instructions/admin` (linked from the admin nav as **Setup guide**) - static, accessible guides that deploy with the app.
- **Public Smartsheet forms** (`/forms`): create from template/scratch, edit fields and allowed email domains in the Builder, then **Publish** from Manage to share `/f/[slug]`. Anonymous submits write rows to Smartsheet (independent of which form is “Active” for admin testing). Optional Cloudflare Turnstile via `FORMS_TURNSTILE_*` env vars.

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your Smartsheet and Admin credentials:

- `SMARTSHEET_API_TOKEN`: Your Smartsheet API token.
- `SMARTSHEETS_VIEW_ADMIN_USERNAME`: Initial admin username.
- `SMARTSHEETS_VIEW_ADMIN_PASSWORD`: Initial admin password.
- `SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET` (strongly recommended in production): Signs admin session cookies. If omitted, signing is derived from the bootstrap username and password — changing the password then invalidates all admin sessions. Prefer a long random secret independent of the password (see **Admin session cookies** below).
- `DATABASE_URL` (Optional locally, required for durable production): Connect to Postgres for admin users and config (sources/views). When set, sources and views are stored in Postgres instead of config files, enabling reliable create/edit/delete on Railway and other hosts with non-durable local filesystems.
- `CONTRIBUTOR_SESSION_SECRET` (Required for contributor editing): Secret used to sign contributor session cookies.
- `SMARTSHEETS_VIEW_PUBLIC_BASE_URL` (Optional): Explicit external origin used for `{{PUBLIC_URL}}` in custom headers. Recommended if the app sits behind an unusual proxy/load balancer or you do not want host/proto inferred from trusted proxy headers.

Postgres requirement:

- The app expects **PostgreSQL 13 or newer**.
- The schema uses `gen_random_uuid()` without installing `pgcrypto` at app startup.
- This is compatible with Railway Postgres, Neon, Vercel Postgres, and similar hosted Postgres providers, but older Postgres versions are not supported.
- If you host on Supabase, any new backend-owned table created in `public` must ship with RLS enabled in the same code change. Update `sql/enable-public-rls.sql` for existing databases and rerun Security Advisor after deploy.

### 3. Run Development Server

```bash
npm run dev
```

(`next dev` should use `--webpack` in this repo; see **Production deployment** below.)

### 4. Admin: Creating a Source

Go to **Admin** > **Sources** and click **Create source**. You will configure:

| Field | Purpose |
|-------|---------|
| **Source ID** | Internal identifier for this app. Must be **unique**, use only **letters, numbers, hyphens, and underscores** (server-enforced, max length), and is set at creation. Example: `grad-programs` |
| **Label** | Display name shown in the admin UI. Can include spaces and punctuation. Can be changed anytime. Example: `Graduate Programs` |
| **Source type** | Choose **Sheet** or **Report** to match your Smartsheet asset. |
| **Smartsheet ID** | The numeric ID from Smartsheet. Find it in the sheet/report URL: `https://app.smartsheet.com/sheets/XXXXXXXXXXXXXXX` or `.../reports/XXXXXXXXXXXXXXX` - the long number is the ID. |

After saving, use **Test connection** to verify the Smartsheet API can reach the sheet or report. Then create **Views** that select columns and define how data is displayed.

### Source role groups

After you fetch schema, use **Merge detected role groups** to append numbered role groups from column titles such as:

- `... Name 1`
- `... Email 1`
- bare role labels like `... Coordinator or Designee 1`

Review the **Role groups** section on the source editor after merging:

- numbered-slot groups are safe by structure
- single-attribute delimited groups are safe because there is no cross-column pairing
- multi-attribute delimited groups are read-only by default unless you explicitly enable **Trust positional pairing** for a known-good aligned source

Views can then add a grouped role field as one public header instead of mapping every numbered source column separately.

Grouped role display defaults to a compact plain inline layout so multiple people use horizontal space better in cards, stacked rows, tables, and print views. Admins can switch each grouped role field between horizontal and vertical layouts and choose either plain or capsule styling in the view builder.

## Production deployment

Routine checklist for shipping this app. Railway is the current target host, but the same constraints mostly apply on other managed Node platforms.

### Source control and builds

- Railway and other Git-based hosts deploy from your Git remote, not from uncommitted local changes. Commit and push to ship new code.
- **Webpack vs Turbopack:** Next.js 16 defaults to Turbopack for `next build`. This repo uses **`next dev --webpack`** and **`next build --webpack`** because `pg` and TipTap / ProseMirror are not reliable here under the default bundler. Keep `--webpack` unless you re-validate a full production build.
- **`next build` runs TypeScript checking.** Fix errors locally with `npx tsc --noEmit` or `npm run build` before pushing; your host will fail on the same errors.
- Pin the deployment environment to an LTS Node version (e.g. 22.x) if you want parity with local builds.

### Environment variables (production checklist)

Set these in the Railway service (and any preview/staging environment you use):

| Variable | Purpose |
|----------|---------|
| `SMARTSHEET_API_TOKEN` | Smartsheet API access |
| `SMARTSHEETS_VIEW_ADMIN_USERNAME` | Bootstrap admin username |
| `SMARTSHEETS_VIEW_ADMIN_PASSWORD` | Bootstrap admin password |
| `SMARTSHEETS_VIEW_ADMIN_SESSION_SECRET` | Signs admin session cookies (strong secret; never empty). Rotation logs all admins out immediately; see **Admin session cookies** above |
| `DATABASE_URL` | Postgres for durable sources, views, admin users, contributors, and login rate-limit data |
| `CONTRIBUTOR_SESSION_SECRET` | Signs contributor cookies (required if contributor editing is enabled) |
| `SMARTSHEET_CONNECTIONS_JSON` | Optional multi-connection Smartsheet config |
| `SMARTSHEET_API_BASE_URL` | Optional Smartsheet API base URL override. Use only Smartsheet’s official API bases, for example `https://api.smartsheet.com/2.0` (US) or `https://api.smartsheet.eu/2.0` (EU); other hosts are rejected. |
| `SMARTSHEETS_VIEW_PUBLIC_BASE_URL` | Optional explicit external origin for `{{PUBLIC_URL}}` links in custom headers; useful behind unusual proxies or load balancers |
| `SMARTSHEETS_VIEW_TRUST_PROXY_HEADERS` | Optional override for login rate-limit IP detection and forwarded host/proto trust. Railway / Vercel proxy headers are trusted automatically; set to `true` or `false` explicitly on unusual proxy setups |
| `ALLOWED_DOMAINS` | Default allowed email domains for forms (comma-separated; defaults to `wsu.edu`). Per-form overrides in Form Builder. |
| `FORMS_TURNSTILE_SITE_KEY` / `FORMS_TURNSTILE_SECRET` | Optional Cloudflare Turnstile for public `/f/[slug]` submits. When secret is set, captcha is required. |

Without **`DATABASE_URL`** on Railway or any other environment with non-durable local files, sources and views cannot be persisted reliably, and managed admin users / contributor accounts will not work as intended.

### Postgres and TLS

- Use **PostgreSQL 13+** (`gen_random_uuid()` on contributor-related tables).
- Use a **small** serverless-friendly pool (large pools exhaust provider connection limits).
- By default the app uses your **`DATABASE_URL`** for TLS and **strips `sslmode=no-verify`** from the URL unless **`SMARTSHEETS_VIEW_DATABASE_INSECURE_SSL=true`**. Use that flag only as an escape hatch if the provider’s certificate chain cannot be verified after review.

### Supabase and RLS

If Postgres is Supabase, Security Advisor expects Row Level Security on `public` tables. This app enables RLS on backend-owned tables at bootstrap and creates an allow-all policy scoped to the current app database role so the server can keep working under restricted roles. For databases that already existed before a change, run **`sql/enable-public-rls.sql`** once, and add new tables to that script when you add them in code. If you later change the `DATABASE_URL` role, rerun that bootstrap/script path so the policy follows the new role.

### Runtime, caching, and Smartsheet errors

- Routes that use **`pg`**, password hashing, **`fs`**, or similar must keep **`export const runtime = "nodejs"`** so they are not assumed Edge-safe.
- **`revalidatePath`** only behaves like production outside `next dev`; contributor saves may need a manual refresh locally.
- After Smartsheet writes, the app invalidates relevant paths; treat cache refresh as part of the write contract.
- When debugging Smartsheet failures, use Smartsheet HTTP status, **`errorCode`**, and the payload - not only the HTTP status returned to the browser. Smartsheet rate limits often appear as **429** / error **4003**.

### Custom header HTML

Sanitize server-side with **`sanitize-html`** only. Avoid adding **`jsdom`** to the server bundle in production.

### Deploy steps

1. Push the repository to your Git host and connect it to Railway or your chosen host.
2. Configure the environment variables above.
3. Deploy. The production build command must remain **`next build --webpack`** unless you have re-tested TipTap and `pg` without it.

### Production go-live (first launch)

- Create separate **filtered views per audience** (e.g. campus) if you need one audience per slice without duplicate rows - use existing view filters.
- Confirm **Production** env vars match your checklist (tokens, secrets, `DATABASE_URL`, `CONTRIBUTOR_SESSION_SECRET`).
- Confirm **contact columns** used for contributor eligibility contain real emails where policy requires it.
- Smoke test: contributor sign-in, row edit only where allowed, multi-person group save, public page refresh, quick pass on a phone.

## Roadmap

Track optional hardening, operational follow-ups, and product ideas in your issue tracker (or other docs you keep **in this repository** if you want them shared with everyone who clones the project).

## Project Structure

- `src/app/` - Next.js App Router (public views and admin API)
- `src/components/` - UI components (public layouts and admin builder)
- `src/lib/` - Business logic (Smartsheet client, transforms, filters)
- `config/sources/` - Source configuration files (JSON fallback when DB is not used)
- `config/views/` - View configuration files (JSON fallback when DB is not used)
- `config/themes/` - Custom theme preset files (JSON)
