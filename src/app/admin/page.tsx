import Link from "next/link";
import { listManagedAdminUsers } from "@/lib/admin-users";
import { Button, EmptyState, RecentCard, StatCard } from "@/components/admin/WorkspacePrimitives";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireAdminPageAccess } from "@/lib/admin-page";
import { listSourceConfigs, listViewConfigs } from "@/lib/config/store";

function DataIcon({ kind }: { kind: "sources" | "views" | "published" | "admins" }) {
  const paths = {
    sources: <><ellipse cx="12" cy="5" rx="7" ry="3" /><path d="M5 5v10c0 1.7 3.1 3 7 3s7-1.3 7-3V5" /><path d="M5 10c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>,
    views: <><rect x="4" y="5" width="16" height="14" rx="1.5" /><path d="M4 10h16M10 5v14" /></>,
    published: <><circle cx="12" cy="12" r="8" /><path d="M4.5 12h15M12 4c2.2 2.2 3.4 5 3.4 8S14.2 17.8 12 20M12 4c-2.2 2.2-3.4 5-3.4 8S9.8 17.8 12 20" /></>,
    admins: <><path d="M12 3l7 3v5c0 4.3-2.9 7.4-7 9-4.1-1.6-7-4.7-7-9V6l7-3z" /><path d="M9.5 12l1.6 1.6 3.5-3.6" /></>,
  };
  return <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>{paths[kind]}</svg>;
}

export default async function AdminDashboardPage() {
  const principal = await requireAdminPageAccess("/admin");
  const [sources, views] = await Promise.all([
    listSourceConfigs(),
    listViewConfigs(),
  ]);
  const managedAdmins = principal.role === "owner" ? await listManagedAdminUsers() : [];
  const publicViews = views.filter((view) => view.public);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin builder"
        title="Workspace overview"
        description="Sources, views, and publishing at a glance. Open a list below to configure the catalog."
        actions={
          principal.role === "owner" ? (
            <Link href="/admin/users">
              <Button variant="primary">Manage admins</Button>
            </Link>
          ) : undefined
        }
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sources" value={sources.length} description="Registered sheets and reports." icon={<DataIcon kind="sources" />} />
        <StatCard label="Views" value={views.length} description="Public view definitions." icon={<DataIcon kind="views" />} />
        <StatCard label="Published" value={publicViews.length} description="Live on public routes." icon={<DataIcon kind="published" />} />
        <StatCard
          label="Admins"
          value={managedAdmins.length + 1}
          description={`Owner plus ${managedAdmins.length} managed admin${managedAdmins.length === 1 ? "" : "s"}.`}
          icon={<DataIcon kind="admins" />}
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <RecentCard
          title="Recent sources"
          subtitle="Connection, schema, and role groups."
          action={
            <Link href="/admin/sources">
              <Button>All sources</Button>
            </Link>
          }
        >
          {sources.length === 0 ? (
            <EmptyState
              icon={<DataIcon kind="sources" />}
              title="No sources yet"
              description="Register a Smartsheet sheet or report to make its data available to views."
              action={{ href: "/admin/sources/new", label: "Register a source" }}
            />
          ) : (
            <div className="space-y-2">
              {sources.slice(0, 5).map((source) => (
                <Link
                  key={source.id}
                  href={`/admin/sources/${source.id}`}
                  className="block rounded-xl border border-line bg-white px-4 py-3 transition hover:border-[var(--crimson-line)]"
                >
                  <p className="text-sm font-medium text-ink">{source.label}</p>
                  <p className="mt-1 text-xs text-sub">
                    {source.sourceType} · {source.smartsheetId}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </RecentCard>

        <RecentCard
          title="Recent views"
          subtitle="Layout, fields, preview, and publishing."
          action={
            <Link href="/admin/views">
              <Button>All views</Button>
            </Link>
          }
        >
          {views.length === 0 ? (
            <EmptyState
              icon={<DataIcon kind="views" />}
              title="No views yet"
              description="Build a view to expose selected fields from a source on a public route."
              action={{ href: "/admin/views/new", label: "Create a view" }}
            />
          ) : (
            <div className="space-y-2">
              {views.slice(0, 5).map((view) => (
                <Link
                  key={view.id}
                  href={`/admin/views/${view.id}`}
                  className="block rounded-xl border border-line bg-white px-4 py-3 transition hover:border-[var(--crimson-line)]"
                >
                  <p className="text-sm font-medium text-ink">{view.label}</p>
                  <p className="mt-1 text-xs text-sub">
                    /{view.slug} · {view.layout} · {view.public ? "published" : "draft"}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </RecentCard>
      </section>
    </div>
  );
}
