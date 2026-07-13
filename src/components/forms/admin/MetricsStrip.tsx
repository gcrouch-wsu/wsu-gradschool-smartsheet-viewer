interface MetricsStripProps {
  activeForms: number;
  sheetsAvailable: number;
  approvers: number;
}

export function MetricsStrip({ activeForms, sheetsAvailable, approvers }: MetricsStripProps) {
  const items = [
    { label: "Active forms", value: activeForms },
    { label: "Sheets available", value: sheetsAvailable },
    { label: "Approvers", value: approvers },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl bg-[color:var(--wsu-stone)] px-4 py-3"
        >
          <p className="text-xs font-normal text-[color:var(--wsu-muted)]">{item.label}</p>
          <p className="mt-1 text-[22px] font-medium leading-none text-[color:var(--wsu-ink)]">{item.value}</p>
        </div>
      ))}
    </div>
  );
}
