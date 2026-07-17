"use client";

import Link from "next/link";
import { Card, inputClass, secondaryBtnClass } from "@/components/forms/admin/AdminCard";

interface Column {
  id: number;
  title: string;
  type: string;
}

interface SchemaCardProps {
  columns: Column[];
  newColTitle: string;
  onNewColTitleChange: (value: string) => void;
  onLoadSchema: () => void;
  onAddColumn: () => void;
}

export function SchemaCard({
  columns,
  newColTitle,
  onNewColTitleChange,
  onLoadSchema,
  onAddColumn,
}: SchemaCardProps) {
  return (
    <Card title="Column schema" description="Add columns to the active sheet. Changes affect the live form immediately.">
      <Link href="/forms/builder" className="inline-flex text-sm font-medium text-wsu-crimson hover:underline">
        Open form builder →
      </Link>
      <button type="button" onClick={onLoadSchema} className={secondaryBtnClass}>
        Refresh columns
      </button>
      <ul className="space-y-1 text-sm text-[color:var(--wsu-ink)]">
        {columns.map((c) => (
          <li key={c.id}>
            {c.title} ({c.type}) — ID {c.id}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="New column title"
          value={newColTitle}
          onChange={(e) => onNewColTitleChange(e.target.value)}
          className={`min-w-0 flex-1 ${inputClass}`}
        />
        <button type="button" onClick={onAddColumn} className={secondaryBtnClass}>
          Add column
        </button>
      </div>
    </Card>
  );
}
