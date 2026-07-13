"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

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
    <section className="card">
      <h2>Results for “{q}”</h2>
      {error ? <div className="note note--err">{error}</div> : null}
      {!results ? (
        <p className="spinner">Searching…</p>
      ) : results.length === 0 ? (
        <p className="muted">No matches found.</p>
      ) : (
        <ul className="search-results">
          {results.map((r, i) => (
            <li key={`${r.objectType}-${r.objectId}-${i}`}>
              <span className="tag">{r.objectType}</span> <strong>{r.text}</strong>
              {r.parentObjectName ? <span className="muted"> · in {r.parentObjectName}</span> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function SearchPage() {
  return (
    <div className="forms-wrap">
      <div className="mb-5">
        <h2 className="forms-page-title">Search</h2>
        <p className="forms-page-subtitle">Find submissions and sheets across your Smartsheet account.</p>
      </div>
      <Suspense
        fallback={
          <section className="card">
            <p className="spinner">Loading…</p>
          </section>
        }
      >
        <SearchContent />
      </Suspense>
    </div>
  );
}
