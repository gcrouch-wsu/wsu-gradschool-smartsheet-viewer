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
      <div className="mx-auto flex min-h-[16rem] max-w-2xl items-center justify-center rounded-xl border border-[color:var(--wsu-border)] bg-white">
        <p className="text-sm text-[color:var(--wsu-muted)]">Loading form…</p>
      </div>
    );
  }

  if (form.loadError || !form.schema) {
    return (
      <SubmissionFormEmptyState
        error={form.loadError || "This form is not available."}
        onRetry={form.loadSchema}
        hideManageLink
      />
    );
  }

  if (form.successMessage) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
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
    <div className="mx-auto max-w-2xl px-4 py-8">
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
