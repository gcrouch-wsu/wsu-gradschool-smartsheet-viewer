"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";

interface Result {
  objectId: number;
  objectType: string;
  text: string;
  parentObjectName?: string;
}

function SearchContent() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!q.trim()) return;
    fetch(`/api/forms/search?q=${encodeURIComponent(q)}`)
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || d.message || "Search failed.");
        return d;
      })
      .then((d) => setResults(d.results ?? []))
      .catch((e) => setError(e.message));
  }, [q]);

  return (
    <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-5 shadow-sm">
      <h2 className="text-base font-medium text-[color:var(--wsu-ink)]">Results for “{q}”</h2>
      {error ? <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div> : null}
      {!results ? (
        <p className="mt-4 text-sm text-[color:var(--wsu-muted)]">Searching…</p>
      ) : results.length === 0 ? (
        <p className="mt-4 text-sm text-[color:var(--wsu-muted)]">No matches found.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[color:var(--wsu-border)]">
          {results.map((r, i) => (
            <li key={`${r.objectType}-${r.objectId}-${i}`} className="py-3 text-sm">
              <span className="mr-2 inline-flex rounded-full bg-[color:var(--wsu-stone)] px-2 py-0.5 text-xs font-medium text-[color:var(--wsu-muted)]">
                {r.objectType}
              </span>
              <strong className="text-[color:var(--wsu-ink)]">{r.text}</strong>
              {r.parentObjectName ? <span className="text-[color:var(--wsu-muted)]"> · in {r.parentObjectName}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function SearchPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Forms workspace"
        title="Search"
        description="Find submissions and sheets across your Smartsheet account."
      />
      <Suspense
        fallback={
          <section className="rounded-xl border border-[color:var(--wsu-border)] bg-white p-5 text-sm text-[color:var(--wsu-muted)]">
            Loading…
          </section>
        }
      >
        <SearchContent />
      </Suspense>
    </div>
  );
}
