import Link from "next/link";

interface ViewTabItem {
  id: string;
  label: string;
  rowCount: number;
  hideCount?: boolean;
}

function buildHref(slug: string, viewId: string, layout?: string, embed?: boolean) {
  const params = new URLSearchParams();
  params.set("view", viewId);
  if (layout) {
    params.set("layout", layout);
  }
  if (embed) {
    params.set("embed", "1");
  }
  return `/view/${slug}?${params.toString()}`;
}

export function ViewTabs({
  slug,
  views,
  activeViewId,
  layout,
  embed = false,
}: {
  slug: string;
  views: ViewTabItem[];
  activeViewId: string;
  layout?: string;
  embed?: boolean;
}) {
  return (
    <nav aria-label="Views" className="flex flex-wrap gap-2">
      {views.map((view) => {
        const active = view.id === activeViewId;
        return (
          <Link
            key={view.id}
            href={buildHref(slug, view.id, layout, embed)}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${
              active
                ? "border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)] text-white"
                : "border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-muted)] hover:border-[color:var(--wsu-crimson)] hover:text-[color:var(--wsu-crimson)]"
            }`}
          >
            <span>{view.label}</span>
            {!view.hideCount && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-white/20 text-white" : "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]"}`}>
                {view.rowCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
