import type { Metadata } from "next";
import Link from "next/link";
import {
  FORM_BRAND_HEADER_ACTION_OUTLINE_CLASS,
  FORM_BRAND_HEADER_ACTION_SOLID_CLASS,
  FormBrandHeader,
} from "@/components/forms/submission/FormBrandHeader";

export const metadata: Metadata = {
  title: "Contributor help - create an account and edit your row",
  description:
    "Help for WSU contributors: create a password, sign in, and update your own row on a published Smartsheet view.",
};

export default function ContributorInstructionsPage() {
  return (
    <div className="min-h-screen bg-[color:var(--wsu-stone,#f7f5f2)] text-[color:var(--wsu-ink)]">
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
        actionsLabel="Guide navigation"
        actions={
          <>
            <Link href="/instructions/admin" className={FORM_BRAND_HEADER_ACTION_OUTLINE_CLASS}>
              Admin guide
            </Link>
            <Link href="/" className={FORM_BRAND_HEADER_ACTION_SOLID_CLASS}>
              Published views home
            </Link>
          </>
        }
      />

      <div className="px-4 py-8 sm:px-7 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">
              Smartsheet View
            </p>
            <h1 id="page-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Contributor help
            </h1>
            <p className="mt-4 text-base leading-relaxed text-[color:var(--wsu-muted)]">
              Use this page if you were sent a Smartsheet View link and need to update your own information.
            </p>
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-900">
              <strong>You do not need a password to read this help page.</strong>
            </p>
          </header>

          <main
            id="main"
            tabIndex={-1}
            className="space-y-10 rounded-2xl border border-[color:var(--wsu-border)] bg-white p-6 shadow-sm sm:p-8"
            aria-labelledby="page-title"
          >
            <section aria-labelledby="s-who">
              <h2 id="s-who" className="text-xl font-semibold text-[color:var(--wsu-ink)] sm:text-2xl">
                Who can create an account?
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                You can create a contributor account only if your{" "}
                <code className="rounded bg-[color:var(--wsu-stone)]/40 px-1.5 py-0.5 text-xs">@wsu.edu</code> email
                address appears on the Smartsheet row in the configured contact field for that page.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li>If your WSU email is listed, you can create an account.</li>
                <li>If it is not listed, you cannot create an account for that page.</li>
                <li>
                  If you think you should have access, contact{" "}
                  <a
                    href="mailto:gradschool@wsu.edu"
                    className="font-medium text-[color:var(--wsu-crimson)] underline underline-offset-2"
                  >
                    gradschool@wsu.edu
                  </a>
                  .
                </li>
                <li>
                  You do not choose first-time access yourself — after you enter your email, the system checks whether you
                  need to create a password or sign in.
                </li>
              </ul>
            </section>

            <section aria-labelledby="s-need">
              <h2 id="s-need" className="text-xl font-semibold text-[color:var(--wsu-ink)] sm:text-2xl">
                What you need
              </h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li>The page link you were sent</li>
                <li>Your WSU email address</li>
                <li>A contributor password (separate from your WSU password)</li>
              </ul>
            </section>

            <section aria-labelledby="s-account">
              <h2 id="s-account" className="text-xl font-semibold text-[color:var(--wsu-ink)] sm:text-2xl">
                Get access
              </h2>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li>Open the page link you were sent.</li>
                <li>
                  Select <strong className="text-[color:var(--wsu-ink)]">Contributor sign in</strong>.
                </li>
                <li>Enter your WSU email address and continue.</li>
                <li>
                  The page will either ask you to <strong className="text-[color:var(--wsu-ink)]">create a password</strong>{" "}
                  (first time) or <strong className="text-[color:var(--wsu-ink)]">sign in</strong> (if you already set one).
                </li>
                <li>Submit the form.</li>
              </ol>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                Your contributor password is separate from your WSU password.
              </p>
              <div className="mt-4 rounded-xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-stone)]/20 p-4 text-sm text-[color:var(--wsu-muted)]">
                <p className="font-medium text-[color:var(--wsu-ink)]">Password rule</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>at least 8 characters</li>
                  <li>at least 1 uppercase letter</li>
                  <li>at least 1 number</li>
                  <li>
                    at least 1 special character such as{" "}
                    <code className="rounded bg-white px-1.5 py-0.5 text-xs">!</code>,{" "}
                    <code className="rounded bg-white px-1.5 py-0.5 text-xs">*</code>, or{" "}
                    <code className="rounded bg-white px-1.5 py-0.5 text-xs">_</code>
                  </li>
                </ul>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                If you see a message about{" "}
                <strong className="text-[color:var(--wsu-ink)]">too many sign-in attempts</strong>, wait about fifteen
                minutes before trying again, or contact the administrator who manages the page.
              </p>
            </section>

            <section aria-labelledby="s-edit">
              <h2 id="s-edit" className="text-xl font-semibold text-[color:var(--wsu-ink)] sm:text-2xl">
                Edit your information
              </h2>
              <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li>Sign in.</li>
                <li>Find your row.</li>
                <li>
                  Click <strong className="text-[color:var(--wsu-ink)]">Edit</strong>.
                </li>
                <li>Update the fields shown.</li>
                <li>
                  Click <strong className="text-[color:var(--wsu-ink)]">Save changes</strong>.
                </li>
              </ol>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                Editable fields usually appear as{" "}
                <strong className="text-[color:var(--wsu-ink)]">white boxes with a visible border</strong>. On{" "}
                <strong className="text-[color:var(--wsu-ink)]">table</strong> layouts, the editor may open in a{" "}
                <strong className="text-[color:var(--wsu-ink)]">side panel</strong> instead of on the row — the steps are
                the same.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                You can edit only the rows tied to your email address, and only the fields your administrator made
                editable.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                Some pages merge several Smartsheet lines into one listing when the same program and contacts appear on
                more than one campus. You still get a single form: each field (such as program name) appears once;
                campuses may show as a combined list or badges. Your save updates the sheet row the page uses for
                editing—duplicate lines in Smartsheet should match except where campus differs.
              </p>
            </section>

            <section aria-labelledby="s-groups">
              <h2 id="s-groups" className="text-xl font-semibold text-[color:var(--wsu-ink)] sm:text-2xl">
                Grouped contacts
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                Some pages use grouped contact editing for repeated people such as coordinators, assistants, or program
                contacts.
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <li>
                  You will see one block per person instead of one long text field; some pages show those blocks in a
                  compact horizontal layout.
                </li>
                <li>
                  Use <strong className="text-[color:var(--wsu-ink)]">Add person</strong> to add another person.
                </li>
                <li>
                  Use <strong className="text-[color:var(--wsu-ink)]">Remove</strong> to remove one person.
                </li>
                <li>
                  Some groups also show <strong className="text-[color:var(--wsu-ink)]">Clear everyone</strong>.
                </li>
                <li>
                  Some groups use fixed role slots and will not show{" "}
                  <strong className="text-[color:var(--wsu-ink)]">Add person</strong> or{" "}
                  <strong className="text-[color:var(--wsu-ink)]">Remove</strong>.
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
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                When you save, numbered role groups write back to the matching Smartsheet slot columns. Trusted legacy
                grouped roles write back in the same order they appear in the editor.
              </p>
            </section>

            <section aria-labelledby="s-reset">
              <h2 id="s-reset" className="text-xl font-semibold text-[color:var(--wsu-ink)] sm:text-2xl">
                Password reset
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                There is no self-service password reset. If you cannot sign in, contact{" "}
                <a
                  href="mailto:gradschool@wsu.edu"
                  className="font-medium text-[color:var(--wsu-crimson)] underline underline-offset-2"
                >
                  gradschool@wsu.edu
                </a>{" "}
                and ask for a password reset link from the administrator for your page.
              </p>
            </section>

            <section aria-labelledby="s-trouble">
              <h2 id="s-trouble" className="text-xl font-semibold text-[color:var(--wsu-ink)] sm:text-2xl">
                Troubleshooting
              </h2>
              <div className="mt-4 space-y-4 text-sm leading-relaxed text-[color:var(--wsu-muted)] sm:text-base">
                <div>
                  <h3 className="font-semibold text-[color:var(--wsu-ink)]">I cannot create an account</h3>
                  <p className="mt-2">
                    In most cases your WSU email is not listed on the Smartsheet row for that page. Contact{" "}
                    <a
                      href="mailto:gradschool@wsu.edu"
                      className="font-medium text-[color:var(--wsu-crimson)] underline underline-offset-2"
                    >
                      gradschool@wsu.edu
                    </a>{" "}
                    if you believe that is wrong.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-[color:var(--wsu-ink)]">I cannot see the Edit button</h3>
                  <p className="mt-2">
                    Confirm your WSU email is on the correct row, contributor editing is enabled, and the fields you need
                    are marked editable.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-[color:var(--wsu-ink)]">My save failed</h3>
                  <p className="mt-2">
                    Try again after reading the error message. If it still fails, email{" "}
                    <a
                      href="mailto:gradschool@wsu.edu"
                      className="font-medium text-[color:var(--wsu-crimson)] underline underline-offset-2"
                    >
                      gradschool@wsu.edu
                    </a>{" "}
                    with the page URL, the row you were editing, the exact error text, and the time of the attempt.
                  </p>
                </div>
              </div>
            </section>

            <section aria-labelledby="s-help" className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950">
              <h2 id="s-help" className="text-lg font-semibold">
                Need help?
              </h2>
              <p className="mt-2 leading-relaxed">
                Email{" "}
                <a href="mailto:gradschool@wsu.edu" className="font-medium underline underline-offset-2">
                  gradschool@wsu.edu
                </a>{" "}
                for help with contributor access, password reset, or editing problems.
              </p>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
