export type ApprovalTone = "approved" | "declined" | "pending" | "empty";

/** Classify a workflow cell value for grid highlighting. */
export function approvalTone(
  value: string,
  approvedValues: string[],
  declinedValues: string[],
): ApprovalTone {
  const v = value.trim();
  if (!v) return "empty";
  const lv = v.toLowerCase();
  const approved = new Set(approvedValues.map((x) => x.toLowerCase()));
  const declined = new Set(declinedValues.map((x) => x.toLowerCase()));
  if (approved.has(lv)) return "approved";
  if (declined.has(lv)) return "declined";
  return "pending";
}

export function approvalToneLabel(tone: ApprovalTone): string {
  switch (tone) {
    case "approved":
      return "Approved";
    case "declined":
      return "Declined";
    case "pending":
      return "In progress";
    default:
      return "Empty";
  }
}
