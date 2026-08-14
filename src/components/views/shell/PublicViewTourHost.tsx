"use client";

import { ProductTour } from "@/components/ui/ProductTour";
import { TourHowToButton } from "@/components/ui/ProductTourHost";
import { PUBLIC_VIEW_TOUR_STEPS, PUBLIC_VIEW_TOUR_STORAGE_KEY } from "@/components/views/public-view-tour";
import { useProductTour } from "@/hooks/useProductTour";

/** Client island: How to use + tour overlay for the public view page. */
export function PublicViewTourHost({ enabled = true }: { enabled?: boolean }) {
  const tour = useProductTour(PUBLIC_VIEW_TOUR_STORAGE_KEY, { enabled });

  if (!enabled) return null;

  return (
    <>
      <TourHowToButton onClick={tour.startTour} className="link-pill-muted justify-center whitespace-nowrap text-xs !text-[color:var(--wsu-crimson)]" />
      <ProductTour
        open={tour.open}
        steps={PUBLIC_VIEW_TOUR_STEPS}
        stepIndex={tour.stepIndex}
        onStepIndexChange={tour.setStepIndex}
        onClose={tour.closeTour}
        onComplete={tour.completeTour}
      />
    </>
  );
}
