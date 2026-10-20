type AppLoadingProps = {
  /** Visible status text. Also read by assistive tech. */
  label?: string;
  /**
   * `screen` fills the viewport (root route fallback).
   * `page` fills the content area inside a layout that should stay visible.
   * `inline` sits in the flow for buttons, panels, and lists.
   */
  variant?: "screen" | "page" | "inline";
};

export function AppLoading({ label = "Loading", variant = "page" }: AppLoadingProps) {
  const spinner = (
    <span
      aria-hidden
      className={
        variant === "inline"
          ? "h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-crimson motion-reduce:animate-none"
          : "h-8 w-8 animate-spin rounded-full border-2 border-line border-t-crimson motion-reduce:animate-none"
      }
    />
  );

  if (variant === "inline") {
    return (
      <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-sm text-sub">
        {spinner}
        {label}
      </span>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={
        variant === "screen"
          ? "grid min-h-screen place-items-center bg-paper px-4"
          : "grid min-h-[40vh] place-items-center px-4 py-16"
      }
    >
      <div className="flex flex-col items-center gap-3">
        {spinner}
        <p className="text-sm text-sub">{label}</p>
      </div>
    </div>
  );
}
