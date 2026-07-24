"use client";

export function VisibilitySelect({ 
  label, 
  value, 
  onChange, 
  description 
}: { 
  label: string; 
  value: boolean; 
  onChange: (show: boolean) => void;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-medium text-[color:var(--wsu-ink)]">{label}</span>
        <select
          value={value ? "show" : "hide"}
          onChange={(e) => onChange(e.target.value === "show")}
          className="rounded-lg border border-[color:var(--wsu-border)] bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[color:var(--wsu-crimson)]"
        >
          <option value="show">Show</option>
          <option value="hide">Hide</option>
        </select>
      </div>
      {description && <p className="text-[10px] text-[color:var(--wsu-muted)]">{description}</p>}
    </div>
  );
}
