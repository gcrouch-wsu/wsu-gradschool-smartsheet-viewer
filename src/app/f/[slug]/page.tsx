"use client";

import { use } from "react";
import {
  SubmissionFormEmptyState,
  SubmissionFormView,
  SubmissionSuccessView,
} from "@/components/forms/submission/SubmissionFormView";
import { usePublicSubmissionForm } from "@/components/forms/submission/usePublicSubmissionForm";

export default function PublicFormPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const form = usePublicSubmissionForm(slug);

  if (form.loading && !form.schema) {
    return (
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:py-8">
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-[color:var(--wsu-border)] border-t-[3px] border-t-wsu-crimson border-b-[3px] border-b-wsu-crimson bg-white">
          <p className="text-sm text-[color:var(--wsu-muted)]">Loading form…</p>
        </div>
      </div>
    );
  }

  if (form.loadError || !form.schema) {
    return (
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:py-8">
        <SubmissionFormEmptyState
          error={form.loadError || "This form is not available."}
          onRetry={form.loadSchema}
          hideManageLink
        />
      </div>
    );
  }

  if (form.successMessage) {
    return (
      <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col justify-center px-4 py-6 sm:py-8">
        <SubmissionSuccessView
          message={form.successMessage}
          onSubmitAnother={() => {
            form.resetSuccess();
          }}
          showTrackerLink={false}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col px-4 py-6 sm:py-8">
      <SubmissionFormView
        schema={form.schema}
        serverErrors={form.serverErrors}
        publicMode
        turnstileSiteKey={form.turnstileSiteKey}
        turnstileRequired={form.turnstileRequired}
        renderedAt={form.renderedAt}
        onSubmit={async (values, files, extras) => {
          const result = await form.submit(values, files, extras);
          return { ok: result.ok };
        }}
      />
    </div>
  );
}
