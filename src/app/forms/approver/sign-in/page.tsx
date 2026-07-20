"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ADMIN_PASSWORD_POLICY_MESSAGE } from "@/lib/admin-auth";

function normalizeNextPath(value: string | null) {
  if (!value || !value.startsWith("/forms")) return "/forms/sheet";
  if (value === "/forms" || value === "/forms/") return "/forms/sheet";
  return value;
}

function ApproverSignInForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/forms/approver/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
        setError(payload?.message ?? payload?.error ?? "Unable to sign in.");
        return;
      }

      router.replace(nextPath);
      router.refresh();
    } catch {
      setError("Unable to sign in.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-[color:var(--wsu-ink)]">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          disabled={isPending}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-base text-[color:var(--wsu-ink)] outline-none transition focus:border-[color:var(--wsu-crimson)] focus:ring-2 focus:ring-[color:rgba(166,15,45,0.12)] disabled:cursor-not-allowed disabled:bg-stone-100"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-[color:var(--wsu-ink)]">Password</span>
        <div className="flex overflow-hidden rounded-2xl border border-[color:var(--wsu-border)] bg-white focus-within:border-[color:var(--wsu-crimson)] focus-within:ring-2 focus-within:ring-[color:rgba(166,15,45,0.12)]">
          <input
            type={showPassword ? "text" : "password"}
            name="password"
            autoComplete="current-password"
            required
            disabled={isPending}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full px-4 py-3 text-base text-[color:var(--wsu-ink)] outline-none disabled:cursor-not-allowed disabled:bg-stone-100"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            disabled={isPending}
            className="border-l border-[color:var(--wsu-border)] px-4 text-sm font-medium text-[color:var(--wsu-crimson)] transition hover:bg-[color:rgba(166,15,45,0.05)] disabled:cursor-not-allowed disabled:text-[color:var(--wsu-muted)]"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="btn-crimson w-full rounded-full bg-[color:var(--wsu-crimson)] px-5 py-3 text-sm font-semibold transition hover:bg-[color:var(--wsu-crimson-dark)] disabled:cursor-not-allowed disabled:bg-[color:rgba(166,15,45,0.45)]"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

function SignInContent() {
  const searchParams = useSearchParams();
  const nextPath = normalizeNextPath(searchParams.get("next"));

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,rgba(166,15,45,0.08),rgba(248,246,243,0.9))] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-md rounded-[2rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-8 shadow-[0_24px_64px_rgba(35,31,32,0.07)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--wsu-crimson)]">Forms access</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[color:var(--wsu-ink)]">Approver sign in</h1>
        <p className="mt-3 text-sm leading-6 text-[color:var(--wsu-muted)]">
          Sign in with your approver email and password to access the form and grid views.
        </p>

        <div className="mt-5 rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-sm text-[color:var(--wsu-muted)]">
          Password requirement: {ADMIN_PASSWORD_POLICY_MESSAGE.replace("Admin password must be ", "")}
        </div>

        <div className="mt-6">
          <ApproverSignInForm nextPath={nextPath} />
        </div>

        <p className="mt-6 text-center text-sm text-[color:var(--wsu-muted)]">
          Admin?{" "}
          <a href={`/admin/sign-in?next=${encodeURIComponent(nextPath)}`} className="link-inline">
            Sign in as admin
          </a>
        </p>
      </div>
    </main>
  );
}

export default function ApproverSignInPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[linear-gradient(180deg,rgba(166,15,45,0.08),rgba(248,246,243,0.9))] px-4 py-10 sm:px-6">
          <div className="mx-auto max-w-md rounded-[2rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-8 text-sm text-[color:var(--wsu-muted)]">
            Loading…
          </div>
        </main>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
