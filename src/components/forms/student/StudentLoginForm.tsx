"use client";

import { startTransition, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_PASSWORD_POLICY_MESSAGE } from "@/lib/admin-auth";

type Mode = "sign_in" | "claim";
type Step = "email" | "password";

const fieldClass =
  "min-h-11 w-full rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] px-4 py-3 text-base text-[color:var(--wsu-ink)] outline-none transition placeholder:text-[color:var(--mist)] focus:border-[color:var(--wsu-crimson)] focus:bg-white focus:ring-2 focus:ring-[color:var(--crimson-soft-2)] disabled:cursor-not-allowed disabled:opacity-60";

const primaryButtonClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--wsu-crimson)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--wsu-crimson-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wsu-crimson)] disabled:cursor-not-allowed disabled:bg-[color:rgba(152,30,50,0.45)]";

function StepIndicator({ step }: { step: Step }) {
  const steps = [
    { id: "email" as const, label: "Account" },
    { id: "password" as const, label: "Password" },
  ];
  const activeIndex = step === "email" ? 0 : 1;

  return (
    <ol className="mb-6 flex items-center gap-2" aria-label="Sign-in steps">
      {steps.map((entry, index) => {
        const isActive = entry.id === step;
        const isComplete = index < activeIndex;
        return (
          <li key={entry.id} className="flex min-w-0 flex-1 items-center gap-2">
            <span
              className={[
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors duration-300",
                isActive || isComplete
                  ? "bg-[color:var(--wsu-crimson)] text-white"
                  : "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]",
              ].join(" ")}
              aria-current={isActive ? "step" : undefined}
            >
              {isComplete ? (
                <svg aria-hidden="true" className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3.5 8.5 6.5 11.5 12.5 4.5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span
              className={[
                "truncate text-xs font-medium transition-colors duration-300",
                isActive ? "text-[color:var(--wsu-ink)]" : "text-[color:var(--wsu-muted)]",
              ].join(" ")}
            >
              {entry.label}
            </span>
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={[
                  "mx-1 h-px min-w-4 flex-1 transition-colors duration-300",
                  isComplete ? "bg-[color:var(--wsu-crimson)]" : "bg-[color:var(--wsu-border)]",
                ].join(" ")}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function ErrorAlert({ id, message }: { id: string; message: string }) {
  return (
    <div
      id={id}
      role="alert"
      aria-live="assertive"
      className="flex gap-3 rounded-xl border border-[color:var(--product-err)]/25 bg-[color:var(--product-err)]/5 px-4 py-3 text-sm text-[color:var(--product-err)]"
    >
      <svg aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 5h1.5v4.5h-1.5V5Zm.75 7a.875.875 0 1 1 0-1.75A.875.875 0 0 1 8 12Z" />
      </svg>
      <p>{message}</p>
    </div>
  );
}

export function StudentLoginForm({ returnHref = "/forms/my" }: { returnHref?: string }) {
  const router = useRouter();
  const errorId = useId();
  const [step, setStep] = useState<Step>("email");
  const [mode, setMode] = useState<Mode | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [entered, setEntered] = useState(true);

  function animateStepChange(next: () => void) {
    setEntered(false);
    window.setTimeout(() => {
      next();
      setEntered(true);
    }, 140);
  }

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

      animateStepChange(() => {
        setMode(payload.mode!);
        setPassword("");
        setShowPassword(false);
        setStep("password");
      });
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
    animateStepChange(() => {
      setStep("email");
      setMode(null);
      setPassword("");
      setShowPassword(false);
      setError(null);
    });
  }

  const panelMotion = [
    "transition-all duration-300 ease-out motion-reduce:transition-none",
    entered ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
  ].join(" ");

  if (step === "email") {
    return (
      <div className={panelMotion}>
        <StepIndicator step={step} />

        <form className="space-y-5" onSubmit={handleEmailContinue} aria-busy={isSubmitting}>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-[color:var(--wsu-ink)]">
              Enter your account
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--wsu-muted)]">
              Use your @wsu.edu Student Email from the sheet. We&apos;ll check eligibility and whether you need to
              create a password or sign in.
            </p>
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[color:var(--wsu-ink)]">WSU email</span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@wsu.edu"
              className={fieldClass}
              required
              autoComplete="email"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              autoFocus
            />
          </label>

          {error ? <ErrorAlert id={errorId} message={error} /> : null}

          <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
            {isSubmitting ? (
              <>
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none"
                />
                Checking…
              </>
            ) : (
              "Continue"
            )}
          </button>
        </form>
      </div>
    );
  }

  const isClaim = mode === "claim";

  return (
    <div className={panelMotion}>
      <StepIndicator step={step} />

      <form className="space-y-5" onSubmit={handlePasswordSubmit} aria-busy={isSubmitting}>
        <div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[color:var(--wsu-muted)]">
            <span className="font-medium text-[color:var(--wsu-ink)]">{email}</span>
            <button
              type="button"
              onClick={useDifferentEmail}
              disabled={isSubmitting}
              className="min-h-9 rounded-md px-1.5 font-medium text-[color:var(--wsu-crimson)] underline-offset-2 transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wsu-crimson)] disabled:opacity-50"
            >
              Change account
            </button>
          </div>
          <h3 className="mt-3 text-lg font-semibold tracking-tight text-[color:var(--wsu-ink)]">
            {isClaim ? "Create your password" : "Enter your password"}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--wsu-muted)]">
            {isClaim
              ? "This is your first time. Set a password for the student portal (separate from your WSU password)."
              : "Welcome back. Enter the password you already set for this email."}
          </p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[color:var(--wsu-ink)]">
            {isClaim ? "New password" : "Password"}
          </span>
          <div
            className={[
              "flex min-h-11 overflow-hidden rounded-xl border bg-[color:var(--wsu-paper)] transition focus-within:bg-white focus-within:ring-2 focus-within:ring-[color:var(--crimson-soft-2)]",
              error
                ? "border-[color:var(--product-err)]/50 focus-within:border-[color:var(--product-err)]"
                : "border-[color:var(--wsu-border)] focus-within:border-[color:var(--wsu-crimson)]",
            ].join(" ")}
          >
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-11 w-full bg-transparent px-4 py-3 text-base text-[color:var(--wsu-ink)] outline-none disabled:cursor-not-allowed disabled:opacity-60"
              required
              autoComplete={isClaim ? "new-password" : "current-password"}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : isClaim ? `${errorId}-policy` : undefined}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              disabled={isSubmitting}
              className="min-h-11 shrink-0 border-l border-[color:var(--wsu-border)] px-4 text-sm font-medium text-[color:var(--wsu-crimson)] transition hover:bg-[color:var(--crimson-soft)] disabled:cursor-not-allowed disabled:text-[color:var(--wsu-muted)]"
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {isClaim ? (
          <p id={`${errorId}-policy`} className="text-xs leading-relaxed text-[color:var(--wsu-muted)]">
            {ADMIN_PASSWORD_POLICY_MESSAGE}
          </p>
        ) : null}

        {error ? <ErrorAlert id={errorId} message={error} /> : null}

        <button type="submit" disabled={isSubmitting} className={primaryButtonClass}>
          {isSubmitting ? (
            <>
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none"
              />
              Working…
            </>
          ) : isClaim ? (
            "Set password and continue"
          ) : (
            "Sign in"
          )}
        </button>

        {!isClaim ? (
          <p className="text-center text-xs leading-relaxed text-[color:var(--wsu-muted)]">
            Forgot your password? Contact{" "}
            <span className="font-medium text-[color:var(--wsu-ink)]">gradschool@wsu.edu</span> for a student portal
            reset link.
          </p>
        ) : null}
      </form>
    </div>
  );
}
