"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_PASSWORD_POLICY_MESSAGE } from "@/lib/admin-auth";

type ContributorMode = "sign_in" | "claim";

export function ContributorLoginForm({
  slug,
  viewId,
  returnHref,
}: {
  slug: string;
  viewId: string;
  returnHref: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ContributorMode>("sign_in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const endpoint = mode === "claim" ? "claim" : "login";
      const response = await fetch(`/api/public/views/${slug}/${endpoint}?view=${encodeURIComponent(viewId)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Unable to continue.");
        return;
      }

      startTransition(() => {
        router.replace(returnHref);
        router.refresh();
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to continue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Contributor access options">
        <button
          type="button"
          onClick={() => setMode("sign_in")}
          aria-pressed={mode === "sign_in"}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            mode === "sign_in"
              ? "border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)] text-white"
              : "border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-muted)]"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("claim")}
          aria-pressed={mode === "claim"}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            mode === "claim"
              ? "border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-crimson)] text-white"
              : "border-[color:var(--wsu-crimson)] bg-[color:var(--wsu-paper)] text-[color:var(--wsu-crimson)] hover:bg-[color:var(--wsu-crimson)]/8"
          }`}
        >
          First-time access
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--wsu-ink)]">WSU email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@wsu.edu"
            className="min-h-[48px] w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-sm"
            required
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--wsu-ink)]">
            {mode === "claim" ? "Create password" : "Password"}
          </span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-[48px] w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-sm"
            required
          />
        </label>

        <p className="text-xs text-[color:var(--wsu-muted)]">
          {mode === "claim"
            ? ADMIN_PASSWORD_POLICY_MESSAGE
            : "Use the password you already set for contributor editing."}
        </p>

        {error && (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-[color:var(--wsu-crimson)] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSubmitting
            ? "Working..."
            : mode === "claim"
              ? "Set password and continue"
              : "Sign in"}
        </button>

        <p className="mt-3 text-xs text-[color:var(--wsu-muted)]">
          Forgot your password? Contact gradschool@wsu.edu for a reset link.
        </p>
      </form>
    </div>
  );
}
