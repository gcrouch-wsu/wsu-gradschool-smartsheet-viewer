"use client";

type OktaSignInIntent = "admin" | "student" | "contributor";

const OKTA_START_PATH = "/api/auth/okta/start";

const primaryButtonClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--wsu-crimson)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[color:var(--wsu-crimson-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wsu-crimson)] disabled:cursor-not-allowed disabled:bg-[color:rgba(152,30,50,0.45)]";

export function OktaSignInButton({
  intent,
  nextPath,
  slug,
  viewId,
  disabled = false,
  label = "Sign in with WSU",
  errorMessage,
}: {
  intent: OktaSignInIntent;
  nextPath: string;
  slug?: string;
  viewId?: string;
  disabled?: boolean;
  label?: string;
  errorMessage?: string | null;
}) {
  const params = new URLSearchParams({
    intent,
    next: nextPath,
  });
  if (slug) params.set("slug", slug);
  if (viewId) params.set("view", viewId);

  const href = `${OKTA_START_PATH}?${params.toString()}`;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold tracking-tight text-[color:var(--wsu-ink)]">Sign in with WSU</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[color:var(--wsu-muted)]">
          Use your WSU account. After Okta confirms who you are, this app checks what you can open.
        </p>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-[color:var(--product-err)]/25 bg-[color:var(--product-err)]/5 px-4 py-3 text-sm text-[color:var(--product-err)]"
        >
          {errorMessage}
        </div>
      ) : null}

      <a
        href={disabled ? undefined : href}
        aria-disabled={disabled}
        className={[primaryButtonClass, disabled ? "pointer-events-none opacity-60" : ""].join(" ")}
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
      >
        {label}
      </a>
    </div>
  );
}
