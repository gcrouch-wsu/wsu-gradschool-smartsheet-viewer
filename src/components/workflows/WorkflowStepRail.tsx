"use client";

export interface WorkflowRailStep {
  id: string;
  label: string;
  optional?: boolean;
}

/** Vertical setup rail: every step stays visible, and any step can be opened. */
export function WorkflowStepRail({
  steps,
  activeIndex,
  onSelect,
}: {
  steps: WorkflowRailStep[];
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <nav aria-label="Workflow steps" className="px-4 py-5 sm:px-5">
      <ol className="m-0 list-none p-0">
        {steps.map((step, index) => {
          const isCurrent = index === activeIndex;
          const isDone = index < activeIndex;
          const isLast = index === steps.length - 1;
          return (
            <li key={step.id} className="relative">
              {isLast ? null : (
                <span
                  aria-hidden="true"
                  className="absolute top-[22px] bottom-0 left-[9px] w-px bg-[color:var(--wsu-border)]"
                />
              )}
              <button
                type="button"
                className={[
                  "relative flex w-full items-start gap-3 rounded-lg text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wsu-crimson)]",
                  isLast ? "pb-0" : "pb-6",
                ].join(" ")}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(index)}
              >
                <span
                  aria-hidden="true"
                  className={[
                    "relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    isCurrent
                      ? "border-2 border-[color:var(--wsu-crimson)] bg-white"
                      : isDone
                        ? "bg-[color:var(--wsu-ink)]"
                        : "border-2 border-[color:var(--wsu-border)] bg-white",
                  ].join(" ")}
                >
                  {isCurrent ? (
                    <span className="h-2 w-2 rounded-full bg-[color:var(--wsu-crimson)]" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-[11px] leading-4 text-[color:var(--wsu-muted)]">
                    Step {index + 1}
                    {step.optional ? (
                      <>
                        {" "}
                        - <span className="italic">optional</span>
                      </>
                    ) : null}
                  </span>
                  <span
                    className={[
                      "mt-0.5 block text-sm leading-5",
                      isCurrent
                        ? "font-medium text-[color:var(--wsu-crimson)]"
                        : isDone
                          ? "text-[color:var(--wsu-ink)]"
                          : "text-[color:var(--wsu-muted)]",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
