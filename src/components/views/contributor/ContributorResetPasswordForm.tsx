"use client";

import { useState } from "react";
import Link from "next/link";
import { ADMIN_PASSWORD_POLICY_MESSAGE } from "@/lib/admin-auth";

export function ContributorResetPasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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
      const response = await fetch("/api/public/contributor/password-reset", {
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
      <div className="space-y-4">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-900">
          <p className="font-medium">Password reset successfully.</p>
          <p className="mt-1">You can now sign in with your new password.</p>
        </div>
        <Link
          href="/instructions/contributor"
          className="block w-full rounded-full bg-[color:var(--wsu-crimson)] px-5 py-3 text-center text-sm font-medium text-white hover:bg-[color:var(--wsu-crimson-dark)]"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-[color:var(--wsu-ink)]">New password</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-[48px] w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-sm"
          required
          autoComplete="new-password"
        />
      </label>

      <p className="text-xs text-[color:var(--wsu-muted)]">{ADMIN_PASSWORD_POLICY_MESSAGE}</p>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-[color:var(--wsu-ink)]">Confirm new password</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="min-h-[48px] w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-sm"
          required
          autoComplete="new-password"
        />
      </label>

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
        {isSubmitting ? "Resetting..." : "Reset password"}
      </button>
    </form>
  );
}
