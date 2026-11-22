"use client";

import { EdgeDrawer } from "@/components/ui/EdgeDrawer";
import { buildEmailTrace, type EmailTraceNotice, type EmailTraceStep } from "@/lib/workflows/email-trace";

const STATE_LABEL: Record<EmailTraceStep["state"], string> = {
  done: "Done",
  current: "Stopped here",
  failed: "Failed",
  upcoming: "Not reached",
};

export function EmailTraceDrawer({
  delivery,
  onClose,
}: {
  delivery: {
    recipientEmail: string;
    status: string;
    error: string | null;
    messageIds: string[];
    sesNotices?: EmailTraceNotice[];
  } | null;
  onClose: () => void;
}) {
  const trace = delivery
    ? buildEmailTrace({
        recipientEmail: delivery.recipientEmail,
        status: delivery.status,
        error: delivery.error,
        messageIds: delivery.messageIds ?? [],
        notices: delivery.sesNotices ?? [],
      })
    : null;

  return (
    <EdgeDrawer open={delivery !== null} onClose={onClose} labelledBy="email-trace-title" lightDismiss>
      {delivery && trace ? (
        <div className="flex h-full min-h-0 w-full flex-col bg-white">
          <div className="border-b border-[color:var(--wsu-border)] px-6 py-5">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[color:var(--wsu-crimson)]">Email path</p>
            <h3 id="email-trace-title" className="mt-2 text-2xl font-medium text-[color:var(--wsu-ink)]">
              {delivery.recipientEmail}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[color:var(--wsu-muted)]">{trace.headline}</p>
          </div>
          <ol className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {trace.steps.map((step, index) => (
              <li key={step.label} className="grid grid-cols-[2rem_1fr] gap-3">
                <span
                  className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                    step.state === "failed"
                      ? "bg-red-50 text-red-800"
                      : step.state === "current"
                        ? "bg-[color:var(--wsu-crimson)] text-white"
                        : step.state === "done"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-[color:var(--wsu-stone)] text-[color:var(--wsu-muted)]"
                  }`}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-[color:var(--wsu-ink)]">
                    {step.label}
                    <span className="ml-2 text-xs font-normal text-[color:var(--wsu-muted)]">{STATE_LABEL[step.state]}</span>
                  </p>
                  <p className="mt-1 whitespace-pre-line break-all text-sm leading-6 text-[color:var(--wsu-muted)]">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </EdgeDrawer>
  );
}
