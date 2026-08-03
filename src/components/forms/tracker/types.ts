export interface TrackerStep {
  name: string;
  value: string;
  display: "done" | "current" | "declined" | "upcoming";
}

export interface TrackerSubmission {
  rowId: number;
  label: string;
  email: string;
  createdAt: string | null;
  stages: TrackerStep[];
  overall: string;
  approvalStatus: {
    label: string;
    stage: string;
    value: string;
    state: "done" | "current" | "declined" | "complete" | "not-started";
  };
}

export interface TimelineItem {
  name: string;
  value: string;
  at: string | null;
  by: string | null;
}

export interface TrackerAttachment {
  id: number;
  name: string;
  mimeType?: string;
}

export interface TrackerDiscussion {
  id: number;
  comments?: { text: string; createdBy?: { name?: string }; createdAt?: string }[];
}

/** Approver contact reroute history for a submission. */
export interface ContactChangeLogItem {
  id: string;
  stageTitle: string;
  status: "pending" | "approved" | "rejected";
  proposedName: string;
  proposedEmail: string;
  note?: string;
  requestedBy: { name: string; email?: string };
  requestedAt: string;
  reviewedBy?: { name: string; email?: string };
  reviewedAt?: string;
  reviewNote?: string;
  fields: Array<{
    previousDisplay: string;
    previousEmail: string;
    previousName: string;
  }>;
}
