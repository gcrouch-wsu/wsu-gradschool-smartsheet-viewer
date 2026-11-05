import type { Metadata } from "next";
import { HeaderIconLink } from "@/components/auth/HeaderLogoutLink";
import { AdminGuideTabs } from "@/components/admin/AdminGuideTabs";
import { FormBrandHeader } from "@/components/forms/submission/FormBrandHeader";

export const metadata: Metadata = {
  title: "Admin guide - Smartsheet View",
  description: "Create sources, build views, publish updates, manage contributors, and operate Smartsheet View safely.",
};

function AdminIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </svg>
  );
}

function ContributorGuideIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </svg>
  );
}

export default function AdminInstructionsPage() {
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
            <HeaderIconLink href="/admin" label="Admin">
              <AdminIcon />
            </HeaderIconLink>
            <HeaderIconLink href="/instructions/contributor" label="Contributor guide">
              <ContributorGuideIcon />
            </HeaderIconLink>
          </div>
        }
      />

      <div className="mx-auto flex min-h-0 w-full max-w-[1200px] flex-1 flex-col px-4 py-6 sm:px-7 sm:py-8">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-line border-b-[3px] border-b-wsu-crimson bg-surface shadow-[var(--shadow-md)]">
          <header className="shrink-0 border-b border-line px-5 py-5 sm:px-8 sm:py-6">
            <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-crimson">
              Smartsheet View Admin
            </p>
            <h1 id="page-title" className="mt-1 font-serif text-[28px] font-medium leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">
              Admin guide
            </h1>
            <p className="mt-2 max-w-[58ch] text-sm leading-6 text-sub">
              This guide is organized around the real builder tabs and control names so you can configure views without
              guessing what each section does.
            </p>
          </header>

          <main
            id="main"
            tabIndex={-1}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6"
            aria-labelledby="page-title"
          >
            <AdminGuideTabs />
          </main>
        </div>
      </div>
    </div>
  );
}
