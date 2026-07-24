import { CampusBadgeStrip } from "@/components/views/shared/CampusBadgeStrip";
import type { ResolvedViewRow, ViewPresentationConfig } from "@/lib/config/types";

/** Campus badges for rows merged across sheet lines (email merge unions campuses; campus merge same picklist). */
export function MergedRowCampusBadges({
  row,
  /** Hide when program section headers already show the full campus strip for the group. */
  suppressWhenProgramSections,
  presentation,
}: {
  row: ResolvedViewRow;
  suppressWhenProgramSections?: boolean;
  presentation?: ViewPresentationConfig;
}) {
  if (presentation?.showMergedCampusBadgesOnRecords === false) {
    return null;
  }
  if (suppressWhenProgramSections || !row.mergedCampuses?.length) {
    return null;
  }
  return (
    <CampusBadgeStrip
      campuses={row.mergedCampuses}
      className="mt-2"
      badgeStyle={presentation?.campusBadgeStyle}
    />
  );
}
