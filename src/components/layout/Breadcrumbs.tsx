import Link from "next/link";

export interface BreadcrumbItem {
  href: string | null;
  label: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  return (
    <nav className="mb-5 flex flex-wrap items-center gap-2 text-sm text-[color:var(--wsu-muted)]" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={index} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden>/</span>}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="link-inline-muted"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-[color:var(--wsu-ink)]" : undefined}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
