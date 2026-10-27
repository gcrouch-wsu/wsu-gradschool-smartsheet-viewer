export function HeaderLogoutLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      aria-label="Log out"
      title="Log out"
      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-white text-ink hover:border-crimson focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson"
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
        <path d="M16 17l5-5-5-5M21 12H9" />
      </svg>
    </a>
  );
}
