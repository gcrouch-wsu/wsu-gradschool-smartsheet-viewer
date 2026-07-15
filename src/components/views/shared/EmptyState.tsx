export function EmptyState({ label }: { label?: string }) {
  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-[color:var(--wsu-border)] bg-[color:var(--wsu-paper)] px-6 py-16 text-center shadow-[0_16px_40px_rgba(35,31,32,0.06)]">
      <p className="text-sm font-medium text-[color:var(--wsu-muted)]">
        {label ?? "No records found."}
      </p>
    </div>
  );
}
