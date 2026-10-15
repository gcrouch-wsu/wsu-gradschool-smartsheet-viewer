interface MetricsStripProps {
  activeForms: number | null;
}

function MetricValue({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="inline-block h-7 w-10 animate-pulse rounded bg-[color:var(--wsu-border)]" aria-hidden />;
  }
  return <>{value}</>;
}

export function MetricsStrip({ activeForms }: MetricsStripProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-tour="fm-metrics">
      <div className="rounded-xl bg-[color:var(--wsu-stone)] px-4 py-3">
        <p className="text-xs font-normal text-[color:var(--wsu-muted)]">Active forms</p>
        <p className="mt-1 text-[22px] font-medium leading-none text-[color:var(--wsu-ink)]">
          <MetricValue value={activeForms} />
        </p>
      </div>
    </div>
  );
}
