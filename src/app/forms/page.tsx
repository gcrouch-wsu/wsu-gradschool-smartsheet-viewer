"use client";

import {
  SubmissionFormEmptyState,
  SubmissionFormView,
  SubmissionSuccessView,
} from "@/components/forms/submission/SubmissionFormView";
import { useSubmissionForm } from "@/components/forms/submission/useSubmissionForm";

export default function FormPage() {
  const form = useSubmissionForm();

  if (form.loading && !form.schema) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center rounded-xl border border-[color:var(--wsu-border)] bg-white">
        <p className="text-sm text-[color:var(--wsu-muted)]">Loading form…</p>
      </div>
    );
  }

  if (form.loadError || !form.schema) {
    return <SubmissionFormEmptyState error={form.loadError || "Could not load the form."} onRetry={form.loadSchema} />;
  }

  if (form.successMessage) {
    return (
      <SubmissionSuccessView
        message={form.successMessage}
        onSubmitAnother={() => {
          form.resetSuccess();
        }}
      />
    );
  }

  return (
    <SubmissionFormView
      schema={form.schema}
      serverErrors={form.serverErrors}
      onSubmit={async (values, files) => {
        const result = await form.submit(values, files);
        return { ok: result.ok };
      }}
    />
  );
}
