"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ADMIN_PASSWORD_POLICY_MESSAGE } from "@/lib/admin-auth";

const fieldClass =
  "min-h-11 w-full rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] px-4 py-3 text-base text-[color:var(--wsu-ink)] outline-none transition placeholder:text-[color:var(--mist)] focus:border-[color:var(--wsu-crimson)] focus:bg-white focus:ring-2 focus:ring-[color:var(--crimson-soft-2)] disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--wsu-crimson)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--wsu-crimson-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wsu-crimson)] disabled:cursor-not-allowed disabled:bg-[color:rgba(152,30,50,0.45)]";

export function AdminResetPasswordForm({ token }: { token: string }) {
  const errorId = useId();
  const policyId = useId();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; ok?: boolean } | null;
      if (!response.ok) {
        setError(payload?.error ?? "Unable to reset password.");
        return;
      }

      setSuccess(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to reset password.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="space-y-5">
        <div
          role="status"
          className="rounded-xl border border-[color:var(--product-ok)]/25 bg-[color:var(--product-ok)]/5 px-4 py-4 text-sm text-[color:var(--product-ok)]"
        >
          <p className="font-medium">Password updated</p>
          <p className="mt-1 text-[color:var(--wsu-muted)]">You can now sign in with your new password.</p>
        </div>
        <Link href="/admin/sign-in" className={primaryButtonClass}>
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit} aria-busy={isSubmitting}>
      <label className="block space-y-2">
        <span className="text-sm font-medium text-[color:var(--wsu-ink)]">New password</span>
        <div className="flex min-h-11 overflow-hidden rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] transition focus-within:border-[color:var(--wsu-crimson)] focus-within:bg-white focus-within:ring-2 focus-within:ring-[color:var(--crimson-soft-2)]">
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="min-h-11 w-full bg-transparent px-4 py-3 text-base text-[color:var(--wsu-ink)] outline-none"
            required
            autoComplete="new-password"
            aria-describedby={policyId}
            aria-invalid={Boolean(error)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            className="min-h-11 shrink-0 border-l border-[color:var(--wsu-border)] px-4 text-sm font-medium text-[color:var(--wsu-crimson)] transition hover:bg-[color:var(--crimson-soft)]"
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      <p id={policyId} className="text-xs leading-relaxed text-[color:var(--wsu-muted)]">
        {ADMIN_PASSWORD_POLICY_MESSAGE}
      </p>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-[color:var(--wsu-ink)]">Confirm new password</span>
        <input
          type={showPassword ? "text" : "password"}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className={fieldClass}
          required
          autoComplete="new-password"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
      </label>

      {error ? (
        <div
          id={errorId}
          role="alert"
          aria-live="assertive"
          className="flex gap-3 rounded-xl border border-[color:var(--product-err)]/25 bg-[color:var(--product-err)]/5 px-4 py-3 text-sm text-[color:var(--product-err)]"
        >
          <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 5h1.5v4.5h-1.5V5Zm.75 7a.875.875 0 1 1 0-1.75A.875.875 0 0 1 8 12Z" />
          </svg>
          <p>{error}</p>
        </div>
      ) : null}

      <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
        {isSubmitting ? (
          <>
            <span
              aria-hidden="true"
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none"
            />
            Resetting…
          </>
        ) : (
          "Reset password"
        )}
      </button>
    </form>
  );
}
