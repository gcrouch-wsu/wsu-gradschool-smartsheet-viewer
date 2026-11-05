"use client";

import type { ReactNode } from "react";
import { ProductTour, type ProductTourStep } from "@/components/ui/ProductTour";
import { headerIconButtonClass } from "@/components/auth/HeaderLogoutLink";
import { useProductTour } from "@/hooks/useProductTour";

export const tourHowToBtnClass = headerIconButtonClass;

export function TourHowToButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="How to use"
      title="How to use"
      className={[tourHowToBtnClass, className].filter(Boolean).join(" ")}
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
        <circle cx="12" cy="12" r="9" />
        <path d="M9.5 9a2.5 2.5 0 114.5 1.5c0 1.5-2 2-2 3.5" />
        <path d="M12 17h.01" />
      </svg>
    </button>
  );
}

/**
 * Client island for server-rendered pages: How to use button + ProductTour overlay.
 * Place `data-tour` attributes on sibling/descendant markup for step targets.
 */
export function ProductTourHost({
  storageKey,
  steps,
  enabled = true,
  buttonClassName,
  children,
}: {
  storageKey: string;
  steps: ProductTourStep[];
  enabled?: boolean;
  buttonClassName?: string;
  children?: ReactNode;
}) {
  const tour = useProductTour(storageKey, { enabled });

  return (
    <>
      {children}
      <TourHowToButton onClick={tour.startTour} className={buttonClassName} />
      <ProductTour
        open={tour.open}
        steps={steps}
        stepIndex={tour.stepIndex}
        onStepIndexChange={tour.setStepIndex}
        onClose={tour.closeTour}
        onComplete={tour.completeTour}
      />
    </>
  );
}

/** Same as ProductTourHost but only renders the button + overlay (no children wrapper). */
export function ProductTourControls({
  storageKey,
  steps,
  enabled = true,
  buttonClassName,
}: {
  storageKey: string;
  steps: ProductTourStep[];
  enabled?: boolean;
  buttonClassName?: string;
}) {
  const tour = useProductTour(storageKey, { enabled });

  return (
    <>
      <TourHowToButton onClick={tour.startTour} className={buttonClassName} />
      <ProductTour
        open={tour.open}
        steps={steps}
        stepIndex={tour.stepIndex}
        onStepIndexChange={tour.setStepIndex}
        onClose={tour.closeTour}
        onComplete={tour.completeTour}
      />
    </>
  );
}
