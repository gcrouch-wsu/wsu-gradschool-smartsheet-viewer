"use client";

/** Default WSU-style cougar mark when no custom logo is uploaded. */
function DefaultCougarMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M12.5 28.5c1.2-8.4 7.6-15.2 16.2-17.4 2.1-.5 4.3-.6 6.4-.3 3.8.6 7.2 2.5 9.8 5.3 1.4 1.5 3.8 1.8 5.5.6l2.6-1.8c1.4-1 3.4-.4 4.1 1.2.8 1.9-.2 4-2.1 4.7l-3.1 1.1c-1.9.7-3.1 2.6-2.9 4.6.4 4.6-.7 9.1-3.3 12.9-2.9 4.3-7.4 7.2-12.5 8.1-7.6 1.3-15-2.3-18.7-8.8-2.2-3.9-2.8-8.5-2-12.9z"
      />
      <path
        fill="currentColor"
        d="M38.2 22.4c2.8-1.1 5.9-.6 8.2 1.3 1.3 1.1 1.7 2.9.9 4.4-.8 1.5-2.6 2.2-4.2 1.7-2.4-.7-4.5-2.4-5.7-4.6-.6-1.1-.3-2.5.8-2.8z"
      />
      <path
        fill="currentColor"
        opacity="0.85"
        d="M22.8 34.2c.9 0 1.7.6 2 1.5.4 1.2-.2 2.5-1.4 2.9-1.2.4-2.5-.2-2.9-1.4-.4-1.2.2-2.5 1.4-2.9.3-.1.6-.1.9-.1z"
      />
      <path
        fill="currentColor"
        d="M18.4 41.6c2.1 3.2 5.6 5.3 9.5 5.7 1.4.1 2.5 1.4 2.3 2.8-.2 1.4-1.5 2.4-2.9 2.2-5.5-.6-10.4-3.6-13.3-8.1-.8-1.2-.3-2.9 1-3.4 1.1-.4 2.4 0 3.4.8z"
      />
    </svg>
  );
}

export type FormBrandHeaderProps = {
  /** Custom PNG/JPEG data URL from form settings. */
  logoDataUrl?: string | null;
  /** Required for accessibility when a custom logo is set. */
  logoAlt?: string | null;
  className?: string;
  /** Constrain width to match the form card. */
  maxWidthClassName?: string;
};

/**
 * Institutional form header: crimson top rule, white bar, logo.
 * Custom logos usually already include the WSU wordmark — text lockup is only shown with the default mark.
 */
export function FormBrandHeader({
  logoDataUrl,
  logoAlt,
  className = "",
  maxWidthClassName = "max-w-7xl",
}: FormBrandHeaderProps) {
  const customLogo = Boolean(logoDataUrl?.trim() && logoAlt?.trim());

  return (
    <header
      className={[
        "border-b border-[color:var(--wsu-border)] bg-white",
        "border-t-[3px] border-t-wsu-crimson",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className={`mx-auto flex w-full items-center gap-4 px-4 py-3 sm:px-6 ${maxWidthClassName}`}>
        {customLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- data URL or remote URL from form config
          <img
            src={logoDataUrl!}
            alt={logoAlt!}
            className="h-10 w-auto max-w-[min(100%,20rem)] object-contain object-left sm:h-12 sm:max-w-[24rem]"
            decoding="async"
          />
        ) : (
          <>
            <div className="flex shrink-0 items-center text-wsu-crimson">
              <DefaultCougarMark className="h-10 w-10 sm:h-12 sm:w-12" />
            </div>
            <div className="hidden h-10 w-px shrink-0 bg-[color:var(--wsu-ink)]/25 sm:block" aria-hidden="true" />
            <div className="min-w-0 leading-tight text-[color:var(--wsu-ink)]">
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.06em] sm:text-xs">Washington State</p>
              <p className="text-[0.7rem] font-normal uppercase tracking-[0.22em] sm:text-xs">University</p>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
