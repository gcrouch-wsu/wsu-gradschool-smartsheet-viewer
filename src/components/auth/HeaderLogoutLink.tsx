import type { ReactNode } from "react";

export const headerIconButtonClass =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line-strong bg-white text-ink hover:border-crimson focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson";

function initialsFromName(name: string): string {
  const source = name.includes("@") ? name.split("@")[0] ?? name : name;
  const parts = source.trim().split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return (parts[0] ?? name).slice(0, 2).toUpperCase() || "—";
}

/** Same identity chip as the signed-in admin and forms header. */
export function HeaderSignedInIdentity({
  name,
  email,
  detail,
}: {
  name: string;
  email?: string | null;
  detail?: string | null;
}) {
  const label = email && name.toLowerCase() === email.toLowerCase() ? email.split("@")[0] || email : name;
  const tooltip = [email && email !== label ? email : null, detail].filter(Boolean).join(" · ") || label;

  return (
    <div
      data-tour="pv-account"
      className="flex max-w-[11rem] min-w-0 items-center gap-2 rounded-full border border-line-strong bg-white py-1.5 pl-1.5 pr-3"
      title={tooltip}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--crimson-soft)] font-mono text-[10px] font-semibold text-crimson"
        aria-hidden
      >
        {initialsFromName(label)}
      </span>
      <span className="min-w-0 truncate text-[13px] font-semibold leading-none text-ink">{label}</span>
      <span className="sr-only">{tooltip}</span>
    </div>
  );
}

export function HeaderLogoutLink({ href }: { href: string }) {
  return (
    <a href={href} aria-label="Log out" title="Log out" className={headerIconButtonClass}>
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </svg>
    </a>
  );
}

export function HeaderIconLink({
  href,
  label,
  newWindow = false,
  children,
}: {
  href: string;
  label: string;
  newWindow?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      aria-label={label}
      title={label}
      target={newWindow ? "_blank" : undefined}
      rel={newWindow ? "noopener noreferrer" : undefined}
      className={headerIconButtonClass}
    >
      {children}
    </a>
  );
}
