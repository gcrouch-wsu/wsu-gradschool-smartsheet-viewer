"use client";

import { FORM_BRAND_HEADER_ACTION_SOLID_CLASS } from "@/components/layout/AppBrandHeader";
import { StatusPage } from "@/components/StatusPage";
import { DATABASE_UNAVAILABLE_MESSAGE } from "@/lib/database-unavailable";

export function DatabaseUnavailable({ onRetry }: { onRetry?: () => void }) {
  return (
    <StatusPage
      title={DATABASE_UNAVAILABLE_MESSAGE}
      description="The app cannot reach the database. Start it, then try again."
      actions={
        onRetry ? (
          <button type="button" onClick={onRetry} className={FORM_BRAND_HEADER_ACTION_SOLID_CLASS}>
            Try again
          </button>
        ) : null
      }
    />
  );
}
