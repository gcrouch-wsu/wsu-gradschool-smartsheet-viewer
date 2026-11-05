"use client";

import type { ReactNode } from "react";

export interface UnderlineTabItem<T extends string = string> {
  id: T;
  label: string;
  panelId?: string;
  dataTour?: string;
}

export function UnderlineTabs<T extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className = "",
  equalWidth = true,
}: {
  items: readonly UnderlineTabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
  /** Stretch tabs evenly across the row (student detail style). */
  equalWidth?: boolean;
}) {
  const count = Math.max(items.length, 1);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={[
        equalWidth ? `grid border-b border-line` : "flex flex-wrap border-b border-line",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={equalWidth ? { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` } : undefined}
    >
      {items.map((item) => {
        const active = value === item.id;
        return (
          <button
            key={item.id}
            id={item.id ? `tab-${item.id}` : undefined}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={item.panelId}
            data-tour={item.dataTour}
            onClick={() => onChange(item.id)}
            className={`border-b-2 px-3 py-3 text-center text-sm font-medium transition ${
              equalWidth ? "w-full" : "min-w-[8rem]"
            } ${
              active
                ? "border-crimson text-crimson"
                : "border-transparent text-sub hover:border-mist hover:text-ink"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export function UnderlineTabPanel({
  id,
  labelledBy,
  active,
  children,
  className = "",
}: {
  id?: string;
  labelledBy?: string;
  active: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (!active) return null;
  return (
    <section id={id} role="tabpanel" aria-labelledby={labelledBy} className={className}>
      {children}
    </section>
  );
}
