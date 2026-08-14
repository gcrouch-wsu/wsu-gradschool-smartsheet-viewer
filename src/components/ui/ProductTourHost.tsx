"use client";

import type { ReactNode } from "react";
import { ProductTour, type ProductTourStep } from "@/components/ui/ProductTour";
import { useProductTour } from "@/hooks/useProductTour";

export const tourHowToBtnClass =
  "rounded-full border border-[color:var(--crimson-line)] bg-white px-3 py-2 text-sm font-medium text-[color:var(--wsu-crimson)] hover:bg-[color:var(--crimson-soft)]";

export function TourHowToButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={className ?? tourHowToBtnClass}>
      How to use
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
