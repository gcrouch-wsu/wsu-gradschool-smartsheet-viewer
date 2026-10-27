"use client";

import { ProductTour } from "@/components/ui/ProductTour";
import { TourHowToButton } from "@/components/ui/ProductTourHost";
import { PUBLIC_VIEW_TOUR_STEPS, PUBLIC_VIEW_TOUR_STORAGE_KEY } from "@/components/views/public-view-tour";
import { useProductTour } from "@/hooks/useProductTour";
import type { ProductTourStep } from "@/components/ui/ProductTour";

/** Drop steps whose target is not on this page, so the counter does not jump. */
function stepsOnPage(steps: ProductTourStep[]): ProductTourStep[] {
  if (typeof document === "undefined") return steps;
  const present = steps.filter((step) => document.querySelector(step.target));
  return present.length > 0 ? present : steps;
}

/** Client island: How to use + tour overlay for the public view page. */
export function PublicViewTourHost({
  enabled = true,
}: {
  enabled?: boolean;
  className?: string;
  /** Kept so existing call sites stay valid. The control is always the header icon. */
  icon?: boolean;
}) {
  const tour = useProductTour(PUBLIC_VIEW_TOUR_STORAGE_KEY, { enabled });
  const steps = tour.open ? stepsOnPage(PUBLIC_VIEW_TOUR_STEPS) : PUBLIC_VIEW_TOUR_STEPS;

  if (!enabled) return null;

  return (
    <>
      <TourHowToButton onClick={tour.startTour} />
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
