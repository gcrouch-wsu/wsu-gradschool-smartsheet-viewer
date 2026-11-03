import type { Metadata } from "next";
import { HeaderIconLink, HeaderLogoutLink, HeaderSignedInIdentity } from "@/components/auth/HeaderLogoutLink";
import { FormBrandHeader } from "@/components/forms/submission/FormBrandHeader";
import { resolveContributorPrincipal } from "@/lib/identity";

export const metadata: Metadata = {
  title: "Contributor help - sign in and edit your row",
  description:
    "Help for WSU contributors: sign in with your WSU account and update your own row on a published Smartsheet view.",
};

function HomeIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
    </svg>
  );
}

function GuideIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

export default async function ContributorInstructionsPage() {
  const contributor = await resolveContributorPrincipal();
  const signedIn = Boolean(contributor?.email || contributor?.identifier);
  const identityName =
    contributor?.displayName?.trim() || contributor?.email || contributor?.identifier || null;

  return (
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden bg-canvas text-ink">
      <a
        href="#main"
        className={[
          "sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50",
          "focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-ink",
          "focus:shadow-[var(--shadow-md)]",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-crimson",
        ].join(" ")}
      >
        Skip to guide content
      </a>

      <FormBrandHeader
        className="shrink-0"
        actionsLabel="Guide navigation"
        actions={
          <div className="flex items-center gap-2">
            {signedIn && identityName ? (
              <HeaderSignedInIdentity
                name={identityName}
                email={contributor?.email}
                detail="Contributor"
              />
            ) : null}
            <HeaderIconLink href="/instructions/admin" label="Admin guide">
              <GuideIcon />
            </HeaderIconLink>
            <HeaderIconLink href="/" label="Published views home">
              <HomeIcon />
            </HeaderIconLink>
            {signedIn ? <HeaderLogoutLink href="/api/auth/okta/logout?next=/" /> : null}
          </div>
        }
      />

      <div className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col px-4 py-6 sm:px-7 sm:py-8">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-line border-b-[3px] border-b-wsu-crimson bg-surface shadow-[var(--shadow-md)]">
          <header className="shrink-0 border-b border-line px-5 py-5 sm:px-8 sm:py-6">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-crimson">
              Smartsheet View
            </p>
            <h1 id="page-title" className="mt-1 font-serif text-[28px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">
              Contributor help
            </h1>
            <p className="mt-2 max-w-[58ch] text-sm leading-6 text-sub">
              Use this page if you were sent a Smartsheet View link and need to update your own information.
            </p>
            <p className="mt-4 rounded-lg border border-emerald-700/25 bg-emerald-50 px-3.5 py-2.5 text-[13px] leading-5 text-emerald-950">
              <strong className="font-semibold">You do not need a password to read this help page.</strong>
            </p>
          </header>

          <main
            id="main"
            tabIndex={-1}
            className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain px-5 py-1 sm:px-8"
            aria-labelledby="page-title"
          >
              <section aria-labelledby="s-who" className="py-6 sm:py-7">
                <h2 id="s-who" className="font-serif text-lg font-medium tracking-[-0.01em] text-ink sm:text-xl">
                  Who can create an account?
                </h2>
                <p className="mt-2.5 max-w-[68ch] text-[13px] leading-6 text-sub sm:text-sm">
                  You can create a contributor account only if your{" "}
                  <code className="rounded bg-[color:var(--wsu-stone)] px-1.5 py-0.5 font-mono text-[12px] text-ink">
                    @wsu.edu
                  </code>{" "}
                  email address appears on the Smartsheet row in the configured contact field for that page.
                </p>
                <ul className="mt-3 max-w-[68ch] list-disc space-y-1.5 pl-5 text-[13px] leading-6 text-sub sm:text-sm">
                  <li>If your WSU email is listed, you can create an account.</li>
                  <li>If it is not listed, you cannot create an account for that page.</li>
                  <li>
                    If you think you should have access, contact{" "}
                    <a href="mailto:gradschool@wsu.edu" className="link-inline">
                      gradschool@wsu.edu
                    </a>
                    .
                  </li>
                  <li>
                    Sign in with your WSU account. Access is granted only when your email appears in the contact field for
                    that page.
                  </li>
                </ul>
              </section>

              <section aria-labelledby="s-need" className="py-6 sm:py-7">
                <h2 id="s-need" className="font-serif text-lg font-medium tracking-[-0.01em] text-ink sm:text-xl">
                  What you need
                </h2>
                <ul className="mt-3 max-w-[68ch] list-disc space-y-1.5 pl-5 text-[13px] leading-6 text-sub sm:text-sm">
                  <li>The page link you were sent</li>
                  <li>Your WSU email address (@wsu.edu)</li>
                  <li>Access to Sign in with WSU (campus Okta)</li>
                </ul>
              </section>

              <section aria-labelledby="s-account" className="py-6 sm:py-7">
                <h2 id="s-account" className="font-serif text-lg font-medium tracking-[-0.01em] text-ink sm:text-xl">
                  Get access
                </h2>
                <ol className="mt-3 max-w-[68ch] list-decimal space-y-2 pl-5 text-[13px] leading-6 text-sub sm:text-sm">
                  <li>Open the page link you were sent.</li>
                  <li>
                    Select <strong className="font-semibold text-ink">Contributor sign in</strong>.
                  </li>
                  <li>
                    Choose <strong className="font-semibold text-ink">Sign in with WSU</strong> and complete campus login.
                  </li>
                  <li>Return to the page and edit your assigned rows.</li>
                </ol>
                <p className="mt-3 max-w-[68ch] text-[13px] leading-6 text-sub sm:text-sm">
                  You do not create a separate contributor password when WSU sign-in is enabled. If Okta is not configured
                  for a local or test environment, the page may still ask for an app password instead.
                </p>
              </section>

              <section aria-labelledby="s-edit" className="py-6 sm:py-7">
                <h2 id="s-edit" className="font-serif text-lg font-medium tracking-[-0.01em] text-ink sm:text-xl">
                  Edit your information
                </h2>
                <ol className="mt-3 max-w-[68ch] list-decimal space-y-2 pl-5 text-[13px] leading-6 text-sub sm:text-sm">
                  <li>Sign in.</li>
                  <li>Find your row.</li>
                  <li>
                    Click the <strong className="font-semibold text-ink">edit</strong> icon.
                  </li>
                  <li>Update the fields shown.</li>
                  <li>
                    Click <strong className="font-semibold text-ink">Save changes</strong>.
                  </li>
                </ol>
                <p className="mt-3 max-w-[68ch] text-[13px] leading-6 text-sub sm:text-sm">
                  Editable fields usually appear as{" "}
                  <strong className="font-semibold text-ink">white boxes with a visible border</strong>. On{" "}
                  <strong className="font-semibold text-ink">table</strong> layouts, the editor may open in a{" "}
                  <strong className="font-semibold text-ink">side panel</strong> instead of on the row — the steps are the
                  same.
                </p>
                <p className="mt-3 max-w-[68ch] text-[13px] leading-6 text-sub sm:text-sm">
                  You can edit only the rows tied to your email address, and only the fields your administrator made
                  editable.
                </p>
                <p className="mt-3 max-w-[68ch] text-[13px] leading-6 text-sub sm:text-sm">
                  Some pages merge several Smartsheet lines into one listing when the same program and contacts appear on
                  more than one campus. You still get a single form: each field (such as program name) appears once;
                  campuses may show as a combined list or badges. Your save updates the sheet row the page uses for
                  editing—duplicate lines in Smartsheet should match except where campus differs.
                </p>
              </section>

              <section aria-labelledby="s-groups" className="py-6 sm:py-7">
                <h2 id="s-groups" className="font-serif text-lg font-medium tracking-[-0.01em] text-ink sm:text-xl">
                  Grouped contacts
                </h2>
                <p className="mt-2.5 max-w-[68ch] text-[13px] leading-6 text-sub sm:text-sm">
                  Some pages use grouped contact editing for repeated people such as coordinators, assistants, or program
                  contacts.
                </p>
                <ul className="mt-3 max-w-[68ch] list-disc space-y-1.5 pl-5 text-[13px] leading-6 text-sub sm:text-sm">
                  <li>
                    You will see one block per person instead of one long text field; some pages show those blocks in a
                    compact horizontal layout.
                  </li>
                  <li>
                    Use <strong className="font-semibold text-ink">Add person</strong> to add another person.
                  </li>
                  <li>
                    Use <strong className="font-semibold text-ink">Remove</strong> to remove one person.
                  </li>
                  <li>
                    Some groups also show <strong className="font-semibold text-ink">Clear everyone</strong>.
                  </li>
                  <li>
                    Some groups use fixed role slots and will not show{" "}
                    <strong className="font-semibold text-ink">Add person</strong> or{" "}
                    <strong className="font-semibold text-ink">Remove</strong>.
                  </li>
                  <li>
                    Some legacy grouped roles may be display-only if the administrator marked them read-only for safety.
                  </li>
                  <li>
                    If a group shows both name and email, fill the fields your program uses; name or email alone may
                    already match the sheet. Phone is usually optional unless you were told otherwise.
                  </li>
                  <li>
                    You do not need to type comma-separated or semicolon-separated lists when the grouped editor is shown.
                  </li>
                </ul>
                <p className="mt-3 max-w-[68ch] text-[13px] leading-6 text-sub sm:text-sm">
                  When you save, numbered role groups write back to the matching Smartsheet slot columns. Trusted legacy
                  grouped roles write back in the same order they appear in the editor.
                </p>
              </section>

              <section aria-labelledby="s-reset" className="py-6 sm:py-7">
                <h2 id="s-reset" className="font-serif text-lg font-medium tracking-[-0.01em] text-ink sm:text-xl">
                  Cannot sign in
                </h2>
                <p className="mt-2.5 max-w-[68ch] text-[13px] leading-6 text-sub sm:text-sm">
                  If Sign in with WSU fails, or your email is not recognized on the page, contact{" "}
                  <a href="mailto:gradschool@wsu.edu" className="link-inline">
                    gradschool@wsu.edu
                  </a>
                  . For campus account problems, use WSU ITS support. On environments that still use an app password, ask
                  the page administrator for a reset link.
                </p>
              </section>

              <section aria-labelledby="s-trouble" className="py-6 sm:py-7">
                <h2 id="s-trouble" className="font-serif text-lg font-medium tracking-[-0.01em] text-ink sm:text-xl">
                  Troubleshooting
                </h2>
                <div className="mt-3 max-w-[68ch] space-y-4 text-[13px] leading-6 text-sub sm:text-sm">
                  <div>
                    <h3 className="text-[13px] font-semibold text-ink sm:text-sm">I cannot sign in</h3>
                    <p className="mt-1.5">
                      In most cases your WSU email is not listed on the Smartsheet row for that page. Contact{" "}
                      <a href="mailto:gradschool@wsu.edu" className="link-inline">
                        gradschool@wsu.edu
                      </a>{" "}
                      if you believe that is wrong.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-ink sm:text-sm">I cannot see the Edit button</h3>
                    <p className="mt-1.5">
                      Confirm your WSU email is on the correct row, contributor editing is enabled, and the fields you need
                      are marked editable.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-ink sm:text-sm">My save failed</h3>
                    <p className="mt-1.5">
                      Try again after reading the error message. If it still fails, email{" "}
                      <a href="mailto:gradschool@wsu.edu" className="link-inline">
                        gradschool@wsu.edu
                      </a>{" "}
                      with the page URL, the row you were editing, the exact error text, and the time of the attempt.
                    </p>
                  </div>
                </div>
              </section>

              <section
                aria-labelledby="s-help"
                className="my-6 rounded-xl border border-amber-800/20 bg-amber-50 px-4 py-3.5 text-[13px] text-amber-950 sm:my-7 sm:px-5 sm:text-sm"
              >
                <h2 id="s-help" className="text-[13px] font-semibold sm:text-sm">
                  Need help?
                </h2>
                <p className="mt-1.5 leading-6">
                  Email{" "}
                  <a href="mailto:gradschool@wsu.edu" className="font-medium underline underline-offset-2">
                    gradschool@wsu.edu
                  </a>{" "}
                  for help with contributor access or editing problems.
                </p>
              </section>
            </main>
        </div>
      </div>
    </div>
  );
}
