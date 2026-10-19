"use client";

import { FORM_BRAND_HEADER_ACTION_SOLID_CLASS } from "@/components/layout/AppBrandHeader";
import { DatabaseUnavailable } from "@/components/DatabaseUnavailable";
import { StatusPage } from "@/components/StatusPage";
import { isDatabaseUnavailableError } from "@/lib/database-unavailable";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  if (isDatabaseUnavailableError(error)) {
    return <DatabaseUnavailable onRetry={reset} />;
  }

  return (
    <StatusPage
      title="This page could not be loaded."
      description="Try again, or come back shortly."
      actions={
        <button type="button" onClick={reset} className={FORM_BRAND_HEADER_ACTION_SOLID_CLASS}>
          Try again
        </button>
      }
    />
  );
}
