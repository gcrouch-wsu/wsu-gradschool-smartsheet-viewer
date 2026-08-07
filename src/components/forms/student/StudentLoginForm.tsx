"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_PASSWORD_POLICY_MESSAGE } from "@/lib/admin-auth";

type Mode = "sign_in" | "claim";
type Step = "email" | "password";

export function StudentLoginForm({ returnHref = "/forms/my" }: { returnHref?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [mode, setMode] = useState<Mode | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleEmailContinue(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/forms/student/access-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; mode?: Mode }
        | null;

      if (!response.ok || (payload?.mode !== "sign_in" && payload?.mode !== "claim")) {
        setError(payload?.error ?? "Unable to continue.");
        return;
      }

      setMode(payload.mode);
      setPassword("");
      setShowPassword(false);
      setStep("password");
    } catch (lookupError) {
      setError(lookupError instanceof Error ? lookupError.message : "Unable to continue.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const endpoint = mode === "claim" ? "claim" : "login";
      const response = await fetch(`/api/forms/student/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  function useDifferentEmail() {
    setStep("email");
    setMode(null);
    setPassword("");
    setShowPassword(false);
    setError(null);
  }

  if (step === "email") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-[color:var(--wsu-ink)]">Student sign in</h2>
          <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
            Use your @wsu.edu Student Email from the sheet. We&apos;ll check eligibility and whether you need to create a
            password or sign in.
          </p>
        </div>

        <form onSubmit={handleEmailContinue} className="space-y-4">
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--wsu-ink)]">WSU email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@wsu.edu"
              className="min-h-[48px] w-full rounded-2xl border border-[color:var(--wsu-border)] bg-white px-4 py-3 text-sm"
              required
              autoComplete="email"
            />
          </label>

          {error ? (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-full bg-[color:var(--wsu-crimson)] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {isSubmitting ? "Checking..." : "Continue"}
          </button>
        </form>
      </div>
    );
  }

  const isClaim = mode === "claim";

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-[color:var(--wsu-muted)]">
          {email}{" "}
          <button
            type="button"
            onClick={useDifferentEmail}
            className="font-medium text-[color:var(--wsu-crimson)] underline underline-offset-2"
          >
            Change
          </button>
        </p>
        <h2 className="mt-2 text-lg font-semibold text-[color:var(--wsu-ink)]">
          {isClaim ? "Create your password" : "Sign in"}
        </h2>
        <p className="mt-1 text-sm text-[color:var(--wsu-muted)]">
          {isClaim
            ? "This is your first time. Set a password for the student portal (separate from your WSU password)."
            : "Enter the password you already set for this email."}
        </p>
      </div>

      <form onSubmit={handlePasswordSubmit} className="space-y-4">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--wsu-ink)]">
            {isClaim ? "Create password" : "Password"}
          </span>
          <div className="flex min-h-[48px] overflow-hidden rounded-2xl border border-[color:var(--wsu-border)] bg-white focus-within:border-[color:var(--wsu-crimson)] focus-within:ring-2 focus-within:ring-[color:rgba(166,15,45,0.12)]">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-transparent px-4 py-3 text-sm outline-none"
              required
              autoComplete={isClaim ? "new-password" : "current-password"}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="border-l border-[color:var(--wsu-border)] px-4 text-sm font-medium text-[color:var(--wsu-crimson)] transition hover:bg-[color:rgba(166,15,45,0.05)]"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        <p className="text-xs text-[color:var(--wsu-muted)]">
          {isClaim ? ADMIN_PASSWORD_POLICY_MESSAGE : "Use the password you already set for this email."}
        </p>

        {error ? (
          <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-[color:var(--wsu-crimson)] px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
        >
          {isSubmitting ? "Working..." : isClaim ? "Set password and continue" : "Sign in"}
        </button>

        {!isClaim ? (
          <p className="mt-3 text-xs text-[color:var(--wsu-muted)]">
            Forgot your password? Contact gradschool@wsu.edu for a student portal reset link.
          </p>
        ) : null}
      </form>
    </div>
  );
}
