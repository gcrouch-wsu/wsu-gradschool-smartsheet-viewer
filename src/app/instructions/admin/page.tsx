import type { Metadata } from "next";
import Link from "next/link";
import { AdminGuideTabs } from "@/components/admin/AdminGuideTabs";
import {
  FORM_BRAND_HEADER_ACTION_OUTLINE_CLASS,
  FORM_BRAND_HEADER_ACTION_SOLID_CLASS,
  FormBrandHeader,
} from "@/components/forms/submission/FormBrandHeader";

export const metadata: Metadata = {
  title: "Admin guide - Smartsheet View",
  description: "Create sources, build views, publish updates, manage contributors, and operate Smartsheet View safely.",
};

export default function AdminInstructionsPage() {
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
            <Link href="/admin" className={FORM_BRAND_HEADER_ACTION_OUTLINE_CLASS}>
              Admin
            </Link>
            <Link href="/instructions/contributor" className={FORM_BRAND_HEADER_ACTION_SOLID_CLASS}>
              Contributor guide
            </Link>
          </>
        }
      />

      <div className="px-4 py-8 sm:px-7 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <header className="mb-8 rounded-2xl border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--wsu-crimson)]">
              Smartsheet View Admin
            </p>
            <h1 id="page-title" className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Admin guide
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-relaxed text-[color:var(--wsu-muted)]">
              This guide is organized around the real builder tabs and control names so you can configure views without
              guessing what each section does.
            </p>
          </header>

          <main
            id="main"
            tabIndex={-1}
            className="rounded-2xl border border-[color:var(--wsu-border)] bg-white p-6 shadow-sm sm:p-8"
            aria-labelledby="page-title"
          >
            <AdminGuideTabs />
          </main>
        </div>
      </div>
    </div>
  );
}
