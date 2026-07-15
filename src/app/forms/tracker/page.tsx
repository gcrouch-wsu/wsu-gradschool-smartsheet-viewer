"use client";

import { SubmissionTrackerView } from "@/components/forms/tracker/SubmissionTrackerView";
import { useSubmissionTracker } from "@/components/forms/tracker/useSubmissionTracker";

export default function TrackerPage() {
  const tracker = useSubmissionTracker();

  if (tracker.loading && !tracker.subs) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center rounded-xl border border-[color:var(--wsu-border)] bg-white">
        <p className="text-sm text-[color:var(--wsu-muted)]">Loading submissions…</p>
      </div>
    );
  }

  return (
    <SubmissionTrackerView
      subs={tracker.subs ?? []}
      sheetName={tracker.sheetName}
      demo={tracker.demo}
      roles={tracker.roles}
      workflowStages={tracker.workflowStages}
      error={tracker.error}
      refreshing={tracker.refreshing}
      timelines={tracker.timelines}
      attachments={tracker.attachments}
      discussions={tracker.discussions}
      commentText={tracker.commentText}
      actionBusy={tracker.actionBusy}
      onRefresh={() => tracker.loadSubs(true)}
      onToggleTimeline={tracker.toggleTimeline}
      onLoadExtras={tracker.loadExtras}
      onApprove={(id) => tracker.patchRow(id, "approve")}
      onDecline={(id) => tracker.patchRow(id, "decline")}
      onDelete={tracker.deleteRow}
      onCommentChange={(id, text) => tracker.setCommentText((p) => ({ ...p, [id]: text }))}
      onPostComment={tracker.postComment}
    />
  );
}
