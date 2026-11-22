"use client";

export interface WorkflowRailStep {
  id: string;
  label: string;
  description?: string;
  optional?: boolean;
}

type StepState = "current" | "done" | "upcoming";

function stepState(index: number, activeIndex: number): StepState {
  if (index === activeIndex) return "current";
  if (index < activeIndex) return "done";
  return "upcoming";
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3.5 8.5 6.5 11.5 12.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StepMark({ index, state }: { index: number; state: StepState }) {
  const base = "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium";
  if (state === "done") {
    return (
      <span className={`${base} bg-[color:var(--wsu-crimson)] text-white`}>
        <CheckIcon />
      </span>
    );
  }
  if (state === "current") {
    return <span className={`${base} bg-[color:var(--wsu-crimson)] text-white`}>{index + 1}</span>;
  }
  return (
    <span className={`${base} border border-[color:var(--wsu-border)] bg-white text-[color:var(--wsu-muted)]`}>
      {index + 1}
    </span>
  );
}

/** Vertical studio rail on large screens, compact step strip on small screens. */
export function WorkflowStepRail({
  steps,
  activeIndex,
  onSelect,
  eyebrow,
  name,
  templateTitle,
}: {
  steps: WorkflowRailStep[];
  activeIndex: number;
  onSelect: (index: number) => void;
  eyebrow: string;
  name: string;
  templateTitle: string;
}) {
  return (
    <>
      <nav aria-label="Workflow steps" className="lg:hidden">
        <ol className="m-0 flex list-none gap-1 overflow-x-auto p-3">
          {steps.map((step, index) => {
            const state = stepState(index, activeIndex);
            const isCurrent = state === "current";
            return (
              <li key={step.id} className="shrink-0">
                <button
                  type="button"
                  className={[
                    "flex items-center gap-2 rounded-full px-2.5 py-1.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wsu-crimson)]",
                    isCurrent
                      ? "bg-[var(--crimson-soft)] text-[color:var(--wsu-crimson)]"
                      : "text-[color:var(--wsu-muted)] hover:bg-[color:var(--wsu-stone)]",
                  ].join(" ")}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => onSelect(index)}
                >
                  <StepMark index={index} state={state} />
                  <span className={`text-sm ${isCurrent ? "font-medium" : ""}`}>{step.label}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <nav aria-label="Workflow steps" className="hidden lg:block">
        <div className="border-b border-[color:var(--wsu-border)] px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--wsu-crimson)]">
            {eyebrow}
          </p>
          <p className="mt-2 font-serif text-xl leading-snug text-[color:var(--wsu-ink)]">
            {name.trim() || "Untitled workflow"}
          </p>
          <p className="mt-1 text-xs leading-5 text-[color:var(--wsu-muted)]">{templateTitle}</p>
        </div>
        <ol className="m-0 list-none space-y-1 p-3">
          {steps.map((step, index) => {
            const state = stepState(index, activeIndex);
            const isCurrent = state === "current";
            const isLast = index === steps.length - 1;
            return (
              <li key={step.id} className="relative">
                {isLast ? null : (
                  <span
                    aria-hidden="true"
                    className="absolute top-10 bottom-0 left-[22px] w-px bg-[color:var(--wsu-border)]"
                  />
                )}
                <button
                  type="button"
                  className={[
                    "relative flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--wsu-crimson)]",
                    isCurrent
                      ? "bg-[var(--crimson-soft)] shadow-[inset_3px_0_0_var(--wsu-crimson)]"
                      : "hover:bg-white/80",
                  ].join(" ")}
                  aria-current={isCurrent ? "step" : undefined}
                  onClick={() => onSelect(index)}
                >
                  <StepMark index={index} state={state} />
                  <span className="min-w-0 pt-0.5">
                    <span
                      className={[
                        "block text-sm leading-5",
                        isCurrent
                          ? "font-medium text-[color:var(--wsu-ink)]"
                          : state === "done"
                            ? "text-[color:var(--wsu-ink)]"
                            : "text-[color:var(--wsu-muted)]",
                      ].join(" ")}
                    >
                      {step.label}
                      {step.optional ? (
                        <span className="font-normal text-[color:var(--wsu-muted)]">
                          {" "}
                          · optional
                        </span>
                      ) : null}
                    </span>
                    {isCurrent && step.description ? (
                      <span className="mt-1 block text-xs leading-5 text-[color:var(--wsu-muted)]">
                        {step.description}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
