import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type ButtonVariant = "primary" | "outline" | "guide" | "ghost";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "border-crimson bg-crimson text-white shadow-[0_2px_6px_rgba(152,30,50,0.24)] hover:border-[var(--crimson-deep)] hover:bg-[var(--crimson-deep)]",
  outline: "border-line-strong bg-white text-ink hover:border-mist hover:bg-[#faf7f8]",
  guide: "border-[var(--crimson-line)] bg-white text-crimson hover:bg-[var(--crimson-soft)]",
  ghost: "border-transparent bg-transparent text-sub hover:bg-[#f4f0f1] hover:text-ink",
};

export function Button({
  className = "",
  variant = "outline",
  children,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-[13.5px] font-medium transition duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60",
        buttonVariants[variant],
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-line bg-surface ${className}`}>{children}</section>;
}

export function SectionLabel({ children, tone = "crimson" }: { children: ReactNode; tone?: "crimson" | "mist" }) {
  return (
    <p className={`text-xs font-normal ${tone === "crimson" ? "text-crimson" : "text-mist"}`}>
      {children}
    </p>
  );
}

export function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--crimson-soft)] text-crimson">
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: number | string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-xl bg-[color:var(--wsu-stone)] px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-normal text-[color:var(--wsu-muted)]">{label}</p>
        <span className="text-crimson">{icon}</span>
      </div>
      <p className="mt-2 text-[22px] font-medium leading-none tabular-nums text-[color:var(--wsu-ink)]">{value}</p>
      <p className="mt-2 text-[12.5px] leading-4 text-[color:var(--wsu-muted)]">{description}</p>
    </div>
  );
}

export function SessionPanel({
  title,
  body,
  avatarInitials,
  action,
}: {
  title: string;
  body: string;
  avatarInitials: string;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line bg-surface px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <SectionLabel>Session</SectionLabel>
          <div className="mt-2 flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--crimson-soft)] font-mono text-xs font-semibold text-crimson">
              {avatarInitials}
            </span>
            <h2 className="text-sm font-medium text-ink">{title}</h2>
          </div>
          <p className="mt-2 max-w-[58ch] text-[13px] leading-5 text-sub">{body}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}

export function RecentCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="flex h-fit flex-col self-start p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-ink">{title}</h2>
          <p className="mt-1 text-xs text-sub">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="mt-3 max-h-[min(32rem,55vh)] overflow-y-auto overscroll-contain">{children}</div>
    </Card>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "inline",
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { href: string; label: string };
  variant?: "inline" | "panel";
}) {
  const panel = variant === "panel";
  return (
    <div className={`rounded-xl border border-dashed border-line-strong bg-[#fdfbfc] text-center ${panel ? "px-5 py-12" : "px-5 py-7"}`}>
      <div className={`mx-auto flex items-center justify-center rounded-lg border border-[var(--crimson-line)] bg-white text-crimson ${panel ? "h-11 w-11" : "h-9 w-9"}`}>
        {icon}
      </div>
      <h3 className={`mt-3 font-medium text-ink ${panel ? "text-[15px]" : "text-sm"}`}>{title}</h3>
      <p className={`mx-auto mt-1 max-w-[34ch] text-sub ${panel ? "text-sm" : "text-[13px]"}`}>{description}</p>
      {action ? (
        <Link href={action.href} className="mt-3 inline-flex items-center gap-1 text-[13px] font-medium text-crimson hover:underline">
          {action.label} <span aria-hidden>→</span>
        </Link>
      ) : null}
    </div>
  );
}

export function TableShell({
  headers,
  children,
  className = "",
  columns,
  endAlignLastHeader = false,
}: {
  headers?: string[];
  children: ReactNode;
  className?: string;
  /** Desktop column count. Defaults to `headers.length` (falls back to 4). */
  columns?: number;
  /** Right-align the last header (use when the last column is action buttons). */
  endAlignLastHeader?: boolean;
}) {
  const colCount = Math.min(6, Math.max(2, columns ?? headers?.length ?? 4));
  const smColsClass =
    colCount === 2
      ? "sm:grid-cols-2"
      : colCount === 3
        ? "sm:grid-cols-3"
        : colCount === 4
          ? "sm:grid-cols-4"
          : colCount === 5
            ? "sm:grid-cols-5"
            : "sm:grid-cols-6";

  return (
    <section className={`overflow-hidden rounded-xl border border-line bg-surface ${className}`}>
      {headers ? (
        <div className={`grid grid-cols-2 gap-3 border-b border-line bg-[#fbf9fa] px-4 py-2.5 ${smColsClass}`}>
          {headers.map((header, index) => {
            const isLast = index === headers.length - 1;
            return (
              <span
                key={`${header}-${index}`}
                className={`text-xs font-medium text-sub ${endAlignLastHeader && isLast ? "sm:text-right" : ""}`}
              >
                {header}
              </span>
            );
          })}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Chip({ children, tone = "crimson" }: { children: ReactNode; tone?: "crimson" | "neutral" }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${
        tone === "crimson" ? "bg-[var(--crimson-soft)] text-crimson" : "bg-[#f4f0f1] text-sub"
      }`}
    >
      {children}
    </span>
  );
}

export function StatusDot({ label = "Active" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-sub">
      <span className="h-2 w-2 rounded-full bg-[#2e9e5b] shadow-[0_0_0_3px_rgba(46,158,91,0.16)]" />
      {label}
    </span>
  );
}
