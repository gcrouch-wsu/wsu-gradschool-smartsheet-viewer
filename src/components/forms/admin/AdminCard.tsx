"use client";

export const inputClass =
  "w-full rounded-lg border border-[color:var(--wsu-border)] px-3 py-2 text-sm text-[color:var(--wsu-ink)] placeholder:text-[color:var(--wsu-muted)] focus:border-wsu-crimson focus:outline-none focus:ring-1 focus:ring-wsu-crimson";

export const secondaryBtnClass =
  "rounded-lg border border-[color:var(--wsu-border)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--wsu-ink)] hover:bg-[color:var(--wsu-stone)] disabled:opacity-50";

export const primaryBtnClass =
  "rounded-lg bg-wsu-crimson px-4 py-2 text-sm font-medium text-white hover:bg-wsu-crimson-dark disabled:opacity-60";

export function Alert({ ok, text }: { ok?: boolean; text: string }) {
  return (
    <p className={`rounded-lg px-3 py-2 text-xs ${ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
      {text}
    </p>
  );
}

export function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-4">
      <h2 className="text-sm font-medium text-[color:var(--wsu-ink)]">{title}</h2>
      {description ? <p className="mt-1 text-xs text-[color:var(--wsu-muted)]">{description}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}
