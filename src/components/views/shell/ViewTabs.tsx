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
    <nav aria-label="Views" className="view-control-group">
      {views.map((view) => {
        const active = view.id === activeViewId;
        return (
          <Link
            key={view.id}
            href={buildHref(slug, view.id, layout, embed)}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-1.5 ${active ? "view-control-active" : "view-control"}`}
          >
            <span>{view.label}</span>
            {!view.hideCount && (
              <span
                className={`rounded-md px-1.5 py-0.5 text-[10px] tabular-nums ${
                  active ? "bg-white/20 text-white" : "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]"
                }`}
              >
                {view.rowCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
