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
        "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-[13.5px] font-medium transition duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60",
        buttonVariants[variant],
        className,
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[18px] border border-line bg-surface ${className}`}>{children}</section>;
}

export function SectionLabel({ children, tone = "crimson" }: { children: ReactNode; tone?: "crimson" | "mist" }) {
  return (
    <p className={`font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] ${tone === "crimson" ? "text-crimson" : "text-mist"}`}>
      {children}
    </p>
  );
}

export function IconTile({ children }: { children: ReactNode }) {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-[var(--crimson-soft)] text-crimson">
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
    <Card className="group p-[18px_18px_20px] transition duration-200 hover:-translate-y-[3px] hover:border-[var(--crimson-line)] hover:shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between gap-3">
        <SectionLabel>{label}</SectionLabel>
        <IconTile>{icon}</IconTile>
      </div>
      <p className="mt-5 font-serif text-[clamp(2.5rem,5vw,3.25rem)] font-medium leading-[0.95] tracking-[-0.02em] tabular-nums text-ink">
        {value}
      </p>
      <p className="mt-3 text-[13px] leading-5 text-sub">{description}</p>
    </Card>
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
    <section className="rounded-[18px] border border-line bg-[radial-gradient(circle_at_100%_0%,var(--crimson-soft),transparent_55%)] bg-surface px-5 py-5 sm:px-[26px] sm:py-6">
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="min-w-0">
          <SectionLabel>Session</SectionLabel>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-[var(--crimson-soft)] font-mono text-xs font-semibold text-crimson">
              {avatarInitials}
            </span>
            <h2 className="font-serif text-xl font-medium text-ink">{title}</h2>
          </div>
          <p className="mt-3 max-w-[58ch] text-[13px] leading-5 text-sub">{body}</p>
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
    <Card className="flex h-fit flex-col self-start p-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl font-medium text-ink">{title}</h2>
          <p className="mt-1 text-[13px] text-sub">{subtitle}</p>
        </div>
        {action}
      </div>
      <div className="mt-4 max-h-[min(32rem,55vh)] overflow-y-auto overscroll-contain">{children}</div>
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
      <div className={`mx-auto flex items-center justify-center rounded-xl border border-[var(--crimson-line)] bg-white text-crimson shadow-[var(--shadow-sm)] ${panel ? "h-12 w-12" : "h-10 w-10"}`}>
        {icon}
      </div>
      <h3 className={`mt-3 font-serif font-medium text-ink ${panel ? "text-lg" : "text-[15.5px]"}`}>{title}</h3>
      <p className={`mx-auto mt-1 max-w-[34ch] text-sub ${panel ? "text-sm" : "text-[13px]"}`}>{description}</p>
      {action ? (
        <Link href={action.href} className="mt-4 inline-flex items-center gap-1 text-[13px] font-medium text-crimson hover:underline">
          {action.label} <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
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
    <section className={`overflow-hidden rounded-2xl border border-line bg-surface ${className}`}>
      {headers ? (
        <div
          className={`grid grid-cols-2 gap-3 border-b border-line bg-[#fbf9fa] px-5 py-3 ${smColsClass}`}
        >
          {headers.map((header, index) => {
            const isLast = index === headers.length - 1;
            return (
              <span
                key={`${header}-${index}`}
                className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink ${
                  endAlignLastHeader && isLast ? "sm:text-right" : ""
                }`}
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
    <span className={`inline-flex rounded-full px-2.5 py-1 font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] ${tone === "crimson" ? "bg-[var(--crimson-soft)] text-crimson" : "bg-[#f4f0f1] text-sub"}`}>
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
